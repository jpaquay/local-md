# SRE Operations & Maintenance Runbook

This runbook provides actionable procedures for day-to-day operations, failure recovery testing, troubleshooting, and adding or replacing cluster nodes.

---

## 📋 Routine SRE Health Verification

Run these checks from OCI Cloud Shell or an authenticated workstation:

```bash
# 1. Verify all 10 Kubernetes cluster nodes are Ready
ssh oci-arm-1 "kubectl get nodes -o wide"

# 2. Check resource utilization across all nodes
ssh oci-arm-1 "kubectl top nodes"

# 3. Verify VRRP Master status on primary gateway
ssh oci-micro-1 "ip addr show dev ens3 | grep -E '10.0.0.29|10.0.0.200'"
# Expected: ens3 has 10.0.0.29/24 AND ens3:0 has 10.0.0.200/24

# 4. Verify VRRP Standby status on secondary gateway
ssh oci-micro-2 "ip addr show dev ens3 | grep 10.0.0.200"
# Expected: No output (Standby mode)

# 5. Verify outbound NAT egress from zero-public-IP worker
ssh oci-arm-3 "curl -sI https://1.1.1.1 | head -n 1"
# Expected: HTTP/2 301 or 200

# 6. Verify public HTTPS ingress on VIP
curl -sI https://jerome.paquay.org/health
# Expected: HTTP/2 200 OK
```

---

## 🧪 HA Gateway Failover Simulation Procedure

To test failover without disrupting customer traffic:

1. **Start continuous liveliness monitor:**
   ```bash
   while true; do
     STATUS=$(curl -so /dev/null -w "%{http_code} (%{time_total}s)" https://jerome.paquay.org/health)
     echo "[$(date '+%T')] Probe: $STATUS"
     sleep 0.5
   done
   ```

2. **Trigger failover by stopping Keepalived on `oci-micro-1`:**
   ```bash
   ssh oci-micro-1 "sudo systemctl stop keepalived"
   ```

3. **Verify `oci-micro-2` promotion:**
   ```bash
   ssh oci-micro-2 "ip addr show dev ens3:0"
   # Verify log output:
   ssh oci-micro-2 "journalctl -u keepalived -n 20 --no-pager"
   ```

4. **Verify failback by restarting Keepalived on `oci-micro-1`:**
   ```bash
   ssh oci-micro-1 "sudo systemctl start keepalived"
   ```

5. **Confirm `oci-micro-1` reclaims MASTER:**
   Because priority is `101 > 100`, `oci-micro-1` re-acquires `10.0.0.200` automatically.

---

## ➕ Onboarding a New ARM64 Worker Node

Follow these steps when provisioning an additional worker:

1. **OCI Compute Provisioning:**
   ```bash
   oci compute instance launch \
     --availability-domain "<AD_NAME>" \
     --compartment-id "$COMPARTMENT_ID" \
     --shape "VM.Standard.A1.Flex" \
     --shape-config '{"ocpus": 1, "memoryInGBs": 6}' \
     --image-id "<UBUNTU_24_04_AARCH64_IMAGE_OCID>" \
     --subnet-id "$SUBNET_ID" \
     --assign-public-ip false \
     --display-name "instance-arm-X" \
     --ssh-authorized-keys-file ~/.ssh/id_rsa.pub
   ```

2. **Attach Private Route Table to VNIC:**
   ```bash
   VNIC_OCID=$(oci compute instance list-vnics --instance-id "$INSTANCE_OCID" --query "data[0].id" --raw-output)
   oci network vnic update \
     --vnic-id "$VNIC_OCID" \
     --route-table-id "ocid1.routetable.oc1.phx.aaaaaaaabm6h4yqzyypm777bsurfwnx4ec3vuwijzpcge4wrllypl2bzwxya"
   ```

3. **Kernel Alignment & Tuning (via Bastion ProxyJump):**
   ```bash
   ssh -o ProxyJump=oci-micro-1 ubuntu@<PRIVATE_IP> "
     sudo DEBIAN_FRONTEND=noninteractive apt-get update && \
     sudo DEBIAN_FRONTEND=noninteractive apt-get dist-upgrade -y && \
     echo 'vm.swappiness=15' | sudo tee /etc/sysctl.d/99-swappiness.conf && \
     sudo sysctl --system && \
     sudo reboot
   "
   ```

4. **Tailscale & K3s Agent Installation:**
   ```bash
   # Join Tailscale
   curl -fsSL https://tailscale.com/install.sh | sh
   sudo tailscale up --operator=ubuntu --hostname=oci-arm-X

   # Install K3s Agent
   curl -sfL https://get.k3s.io | INSTALL_K3S_VERSION="v1.35.4+k3s1" \
     K3S_URL="https://100.92.249.20:6443" \
     K3S_TOKEN="<CLUSTER_TOKEN>" \
     sh -s - agent \
     --flannel-iface=tailscale0 \
     --node-name=oci-arm-X \
     --node-label custom-hostname=oci-arm-X \
     --node-label role=builder \
     --node-label builder=arm64 \
     --node-label arch=arm64
   ```

5. **Apply Builder Role Label:**
   ```bash
   ssh oci-arm-1 "kubectl label node oci-arm-X node-role.kubernetes.io/builder=true"
   ```

---

## 🛠️ Troubleshooting Matrix

| Issue | Symptom | Root Cause | Resolution |
| :--- | :--- | :--- | :--- |
| **Worker Cannot Reach Internet** | `curl: (7) Failed to connect` | VNIC route table missing or VIP offline | Verify `rt-arm-private` is attached to VNIC; check `ip addr show dev ens3:0` on `oci-micro-1`. |
| **Keepalived Does Not Migrate VIP** | Standby logs `permission denied` | Instance Principal policy missing | Verify dynamic group `WireGuardRouters` and policy statement `manage virtual-network-family`. |
| **Flannel Sandbox Failures** | `open /run/flannel/subnet.env: no such file` | Tailscale interface not up before K3s | Verify `tailscale status`; restart `k3s-agent.service` once `tailscale0` is active. |
| **SSH Times Out to Workers** | `Connection timed out` | ProxyJump misconfigured | Test direct SSH to `oci-micro-1` first; ensure SSH agent has the private key loaded. |
