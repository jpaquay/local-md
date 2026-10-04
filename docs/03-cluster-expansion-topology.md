# Hybrid K3s Cluster Topology & Capacity Scaling

This document details the multi-cloud, hybrid Kubernetes (K3s) cluster architecture, Tenancy Ampere A1 quota allocation, Flannel CNI over Tailscale mesh, and node role scheduling.

---

## 📊 Always Free Tier Quota Maximization

Oracle Cloud Infrastructure provides an **Always Free Ampere A1 Flex** quota of:
- **Maximum 4 OCPUs**
- **Maximum 24 GB Memory**

To maximize distributed resilience and prevent noisy-neighbor contention across builds and services, the tenancy is divided evenly across **four independent 1-OCPU / 6-GB instances**:

```
Tenancy Ampere A1 Pool (4 OCPUs / 24 GB RAM)
├── oci-arm-1: 1 OCPU, 6 GB RAM (Builder, Monitoring, Orchestration)
├── oci-arm-2: 1 OCPU, 6 GB RAM (Bio App, Traefik, User Services)
├── oci-arm-3: 1 OCPU, 6 GB RAM (Tekton Pipeline Worker, SRE Console)
└── oci-arm-4: 1 OCPU, 6 GB RAM (Tekton Pipeline Worker, SRE Console)
```

Combined with the two AMD64 instances (`oci-micro-1` and `oci-micro-2`, 1 vCPU / 1 GB RAM each), the tenancy consumes 100% of available compute resources without incurring billing charges.

---

## 🌐 10-Node Hybrid Cluster Mesh Diagram

```mermaid
graph TB
    subgraph Control_Plane["Hybrid Kubernetes Control Plane"]
        CP["sweetsixty6<br/>100.92.249.20<br/>Debian GNU/Linux 13 (trixie)<br/>Role: control-plane"]
    end

    subgraph OCI_Phoenix_Arm["OCI us-phoenix-1: ARM64 Worker Pool"]
        ARM1["oci-arm-1<br/>100.75.224.60<br/>Ubuntu 24.04 (Kernel 7.0)<br/>Roles: builder, monitoring"]
        ARM2["oci-arm-2<br/>100.70.208.42<br/>Ubuntu 24.04 (Kernel 6.17)<br/>Roles: builder, builder-arm"]
        ARM3["oci-arm-3<br/>100.114.234.82<br/>Ubuntu 24.04 (Kernel 7.0)<br/>Roles: builder"]
        ARM4["oci-arm-4<br/>100.115.101.108<br/>Ubuntu 24.04 (Kernel 7.0)<br/>Roles: builder"]
    end

    subgraph OCI_Phoenix_Amd["OCI us-phoenix-1: AMD64 Gateways"]
        M1["oci-micro-1<br/>100.83.210.38<br/>Kernel 7.0 | VRRP Master"]
        M2["oci-micro-2<br/>100.75.253.22<br/>Kernel 7.0 | VRRP Standby"]
    end

    subgraph OnPrem_Workstations["On-Prem & Workstations"]
        CRALEX["cralex<br/>100.66.14.16<br/>Debian 13 | x86_64 Builder"]
    end

    subgraph Edge_IoT["Edge Raspberry Pi Fleet"]
        RPI4["raspberrypi-20b640d0<br/>100.84.107.117<br/>RPi 4 Model B (Kernel 6.18)"]
        RPI5["raspberrypj-5723f461<br/>100.82.171.38<br/>RPi 5 Model B (Kernel 6.18)"]
    end

    %% Mesh Interconnects
    ARM1 & ARM2 & ARM3 & ARM4 <===>|Flannel CNI over tailscale0| CP
    M1 & M2 <===>|Tailscale Mesh| CP
    CRALEX <===>|Flannel CNI| CP
    RPI4 & RPI5 <===>|Flannel CNI| CP
```

---

## 🔌 Networking: Flannel CNI over Tailscale Overlay

In standard K3s clusters, Flannel binds to the node's primary Ethernet interface (`ens3` or `eth0`). However, because the nodes span different subnets, clouds, and on-premises physical locations, standard L2 broadcast/VXLAN encapsulation fails.

### Solution: `--flannel-iface=tailscale0`
All worker nodes are instructed to bind Flannel encapsulation to their virtual WireGuard interface:
```bash
/usr/local/bin/k3s agent \
    --flannel-iface=tailscale0 \
    --node-name=oci-arm-3 \
    --node-label custom-hostname=oci-arm-3 \
    --node-label role=builder \
    --node-label builder=arm64 \
    --node-label arch=arm64
```

### Key Network Advantages
1. **End-to-End Encryption:** Pod-to-pod network traffic between any two nodes across clouds is encrypted using ChaCha20-Poly1305.
2. **NAT Traversal:** Direct wireguard tunnels punch through NAT boundaries via Tailscale DERP relays.
3. **No Public IP Requirement:** Worker nodes in OCI communicate directly with the on-premise control plane (`100.92.249.20:6443`) over their Tailscale private IP.

---

## 🏷️ Node Labels & Workload Scheduling

Standardized labels ensure deterministic pod scheduling across architectures and roles:

| Label Key | Value | Purpose |
| :--- | :--- | :--- |
| `node-role.kubernetes.io/builder` | `true` | Declares node eligibility for Tekton and CI/CD pipelines |
| `builder` | `arm64` | Targets ARM64 Docker/Kaniko builds |
| `arch` | `arm64` | Hardware architecture affinity |
| `custom-hostname` | `<hostname>` | Stable identifier independent of DHCP |

### DaemonSets Active Across Fleet
- **`svclb-traefik`:** K3s Service LoadBalancer proxying external ingress.
- **`otel-collector-contrib`:** OpenTelemetry collector capturing metrics, traces, and host telemetry.
- **`node-sre-console`:** Local SRE diagnostics console running on host PID namespace.
