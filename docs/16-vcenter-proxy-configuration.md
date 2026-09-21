# vCenter Server appliance: outbound proxy configuration

Configuring the vCenter Server appliance itself to reach the internet
through a proxy (depot access, NTP, DNS-over-internet, external
registration, and similar outbound calls) – not to be confused with a VCF
Operations **Cloud Proxy** (a separate appliance for inbound data
collection, see [Field notes](04-field-notes.md#observability--cloud-proxy-logs-networks)).
Applies regardless of track – VCF, VVF, or standalone vSphere – since this
is a plain vCenter appliance networking setting, independent of any
licensing layer.

**The method is version-specific and the two are not interchangeable.**
Using the pre-9.x file on a 9.x appliance (or vice versa) does not just
fail cleanly – on 9.x it is explicitly called out as the *wrong* file to
touch. Check the running vCenter's major version before following either
section below.

---

## vCenter 7.0.x / 8.0.x

Two methods, per Broadcom KB
[370265](https://knowledge.broadcom.com/external/article/370265/how-to-configure-proxy-settings-for-vcen.html):

**VAMI GUI** (`https://<vcenter-fqdn>:5480` → Networking → Proxy Settings
→ Edit): pick the traffic type (HTTP/HTTPS/FTP), enter the proxy
server/port and optional username/password, Save, then restart services:

```
service-control --stop --all && service-control --start --all
```

**Manual file edit** (SSH to the appliance as root, edit
`/etc/sysconfig/proxy`):

1. Back it up first: `cp proxy proxy.bak`
2. `PROXY_ENABLED="yes"`
3. `HTTP_PROXY="http://proxy.example.com:8080"` and
   `HTTPS_PROXY="http://proxy.example.com:8080"` (same URL if it's a
   single-port proxy for both)
4. `NO_PROXY="localhost,127.0.0.1,example.com"` – CIDR notation is
   supported here from 7.0 U1c onward
5. **Reboot the appliance** (not just a service restart) for the change to
   take effect

---

## vCenter 9.x

**Do not edit `/etc/sysconfig/proxy` on 9.x** – per Broadcom KB
[402684](https://knowledge.broadcom.com/external/article/402684/http-cannot-connect-to-proxy-server-when.html),
that's the pre-9.x file and is explicitly the wrong one here.

**The VAMI UI's proxy validation is broken on 9.x** – it fails trying to
validate the proxy by connecting to `vmware.com` or the vCenter's own IP
through it, surfacing as *"HTTP: Cannot connect to proxy server"* even
with correct settings. The VAMI UI also flatly rejects CIDR notation in
the exclusion list.

**The supported path is a direct JSON file edit:**

1. SSH to the vCenter appliance as root.
2. Edit `/var/lib/vmware-envoy-system-proxy/config.json`.
3. One object per protocol – `http_proxy`, `https_proxy`, `ftp_proxy` –
   each with:
   ```json
   {
     "scheme": "<proxy url schema>",
     "host": "<proxy url host>",
     "port": <port or null>,
     "username": "<credential or null>",
     "password": "<credential or null>"
   }
   ```
   Leave irrelevant protocol entries blank. Remove any comment sections
   before saving – the file must be valid JSON.
4. Add a `no_proxy` array with comma-separated exclusion entries as
   needed – this is also the only place to add **CIDR notation**, since
   the VAMI UI rejects it.
5. **No service restart is needed** after saving.

---

## Sources

- [How to configure proxy settings for vCenter Server](https://knowledge.broadcom.com/external/article/370265/how-to-configure-proxy-settings-for-vcen.html) – VAMI GUI and `/etc/sysconfig/proxy` methods, 7.0.x/8.0.x
- ["HTTP Cannot connect to proxy server" when configuring a proxy in vCenter VAMI UI](https://knowledge.broadcom.com/external/article/402684/http-cannot-connect-to-proxy-server-when.html) – the 9.x `config.json` method and the VAMI UI's known validation failure
