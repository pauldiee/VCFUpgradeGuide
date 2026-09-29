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

**Not every appliance component historically read the same setting the
same way.** Per Broadcom's own proxy-troubleshooting KB
[373713](https://knowledge.broadcom.com/external/article/373713/troubleshooting-vcenter-server-proxy-con.html)
(applies to vCenter Server 7.0 and later), the VAMI (management interface)
uses `wget` internally while VUM / Lifecycle Manager uses `curl` – two
different HTTP clients that can, in principle, resolve proxy settings
from different places (`wget` also reads `/etc/wgetrc` / `~/.wgetrc` on
top of the system-wide setting). Not confirmed by Broadcom as the reason,
but worth knowing: on 9.x, proxy handling moves to a single `config.json`
file rather than the older per-tool arrangement, which removes this
particular class of inconsistency either way.

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

> **Field-observed (2026-09-29, vCenter 9.1): VAMI worked, and was the
> way out.** On this appliance the VAMI UI saved the proxy settings
> without the validation error above, and it was the only thing that got
> the proxy service running again after hand-edits had broken it (see
> [Field warning](#field-warning-a-hand-edited-configjson-can-break-the-proxy-service)).
> Try VAMI first. Fall back to the JSON edit below only when VAMI refuses
> to save, or when you need CIDR in the exclusion list.

### How the 9.x proxy works on the appliance

On 9.x, appliance tools don't talk to the corporate proxy directly. They
go through a **local proxy service**, `vmware-envoy-system-proxy`, which
reads `config.json` and decides per destination whether to forward to the
corporate proxy or connect directly (`no_proxy`). Field-observed via
`env | grep -i proxy` in the vCenter shell:

| Variable | Points to |
| --- | --- |
| `http_proxy` | `http://localhost:1081/` |
| `https_proxy` | `http://localhost:1082/` |
| `ftp_proxy` | `http://localhost:1083/` |
| `no_proxy` | `localhost, 127.0.0.1` |

Three consequences, all seen in the field:

- **Every `curl` from the shell shows `localhost:1082`**, never the
  corporate proxy's name. That's normal, not a misconfiguration.
- **The shell's `no_proxy` is not where exclusions go.** It only keeps
  traffic to the appliance itself away from the local proxy. Exclusions
  for other hosts belong in `config.json` (or VAMI).
- **The local proxy can run on stale settings.** Plain `curl` through
  `localhost:1082` got `407 Proxy Authentication Required`, while
  `curl -x http://<proxy-host>:8080` – the same proxy, which uses no
  authentication – returned 200. Only the reboot that followed showed the
  service couldn't start with the current file at all. If going through
  the local proxy and going straight to the corporate proxy give different
  answers, suspect the local proxy.

Service and file:

```
systemctl status vmware-envoy-system-proxy --no-pager | head -8
ls -la /var/lib/vmware-envoy-system-proxy/
```

The service runs as user `envoy-system-proxy`. On the field appliance
`config.json` was `root`-owned `644` in a `755` folder, readable by that
user. Its request log is under `/var/log/vmware/envoy/`
(`envoy-access*.log`, per KB 438438).

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
5. **No service restart is needed** after saving, per KB 402684. **Do one
   anyway** (`systemctl restart vmware-envoy-system-proxy`), to prove the
   service accepts the file now rather than at the next reboot – see the
   [Field warning](#field-warning-a-hand-edited-configjson-can-break-the-proxy-service).

**Worked example** – HTTP and HTTPS traffic through the same proxy, FTP
left unused, one internal domain and one CIDR block excluded:

```json
{
  "http_proxy": {
    "scheme": "http",
    "host": "proxy.example.com",
    "port": 8080,
    "username": null,
    "password": null
  },
  "https_proxy": {
    "scheme": "http",
    "host": "proxy.example.com",
    "port": 8080,
    "username": null,
    "password": null
  },
  "ftp_proxy": {
    "scheme": null,
    "host": null,
    "port": null,
    "username": null,
    "password": null
  },
  "no_proxy": ["localhost", "127.0.0.1", "example.com", "10.0.0.0/24"]
}
```

Validate the file is syntactically correct JSON before trusting it took
effect – a trailing comma or leftover comment left in from editing is
enough to silently break parsing:

```
python3 -m json.tool /var/lib/vmware-envoy-system-proxy/config.json
```

### Field warning: a hand-edited config.json can break the proxy service

**Field-observed (2026-09-29, vCenter 9.1). Root cause not found.**
Sequence:

1. The proxy was disabled temporarily, then re-enabled by editing
   `config.json` by hand (a `no_proxy` exclusion added). Traffic
   through the local proxy returned `407` from then on (see the stale
   settings point above).
2. After a vCenter reboot, `vmware-envoy-system-proxy` would not start:
   `status=1/FAILURE`, nothing useful in `journalctl`, and every curl
   failed with `Failed to connect to localhost port 1082: Connection
   refused` – **no outbound traffic from the appliance at all**.
3. Ruled out: the file was valid JSON (`python3 -m json.tool`), `644`,
   readable by the service user (`su -s /bin/sh envoy-system-proxy -c
   "cat …"`), no credentials set. The service still failed with
   `no_proxy` cut to `localhost`, and with the file renamed away.
4. **Fix:** with the file renamed away, the proxy was configured through
   **VAMI**, which wrote a new `config.json`. The service started
   normally.
5. A backup of that working file (`cp`), put back after a further failed
   hand-edit, **failed again**. So the contents alone were not the
   difference. Two suspects remain unconfirmed: systemd's start limit (too
   many failed restarts in a row make it refuse, shown as
   `start-limit-hit`; cleared with `systemctl reset-failed`), or something
   VAMI sets beyond the file itself.

What to do with that:

- **Configure the proxy through VAMI**, including the exclusion list, for
  as long as FQDNs and domains are enough.
- **If you do hand-edit, test right away**, not at the next reboot:

  ```
  systemctl restart vmware-envoy-system-proxy; sleep 3
  systemctl is-active vmware-envoy-system-proxy
  curl -v -I https://dl.broadcom.com/ 2>&1 | tail -5
  ```

  A service that's still running on old settings hides a broken file
  until the next boot.
- **Before trusting any repeat test**, run `systemctl reset-failed
  vmware-envoy-system-proxy`, so a start-limit refusal can't be mistaken
  for a bad file.
- **Keep the VAMI-generated file as the reference** – rename, don't
  delete, when experimenting.
- **A failed proxy service means no internet access for vCenter at all.**
  Lifecycle Manager downloads stop. Anything excluded in `no_proxy`
  should be unaffected, if direct access to those hosts is allowed.

---

## Internal VCF components must bypass the proxy

**Field-verified (2026-09-29, VVF upgrade to 9.1):** with an outbound
proxy configured on a vCenter 9.x appliance, assigning a license from VCF
Operations failed with:

> *Failed: The license server SSL certificates are not trusted by the
> vCenter instance.*

The message points at certificates, but the cause was the proxy. vCenter's
traffic to the License Server went through the appliance's system proxy
to the corporate proxy, which couldn't reach the internal License Server.
Correct licensing privileges, and even `administrator@vsphere.local` as
the VCF Operations account, made no difference. **Disabling the proxy for
the assignment fixed it.** No Broadcom KB found that ties this message to
the proxy (searched 2026-09-29).

**Diagnose it from the vCenter shell** – the tell is curl going through a
local proxy listener and the tunnel failing:

```
curl -v https://<license-server-fqdn>/ -o /dev/null
```

```
* Host localhost:1082 was resolved.
> CONNECT <license-server-fqdn>:443 HTTP/1.1
* CONNECT tunnel failed, response 502
```

Then confirm the direct path works by skipping the proxy for one request:

```
curl -v --noproxy '*' https://<license-server-fqdn>/ -o /dev/null
```

`Connected to …` plus a certificate in the output means the License Server
is reachable directly and the proxy is the only thing in the way.

**Permanent fix: exclude it instead of switching the proxy off.** The
License Server isn't contacted only at assignment time; vCenter keeps
talking to it, so a proxy re-enabled afterwards can break licensing again.
Add the License Server FQDN to the proxy exclusion list – preferably in
**VAMI**; `no_proxy` in `config.json` only when you need CIDR, and then
read the [Field warning](#field-warning-a-hand-edited-configjson-can-break-the-proxy-service)
first. Ideally exclude the whole internal management domain, which also
covers VCF Operations and the VCF Management Services FQDNs.

> **Not yet verified end-to-end.** In the field case, the exclusion was
> added while the proxy service was in trouble (see the warning above), so
> "licensing keeps working with the proxy on and the License Server
> excluded" hasn't been confirmed on its own. Check afterwards: the plain
> `curl -v` above should connect directly, with no `localhost:1082`
> `CONNECT`, and the vSphere Client should show no *"not connected to a
> license server"* banner.

---

## Lifecycle Manager download sources behind a proxy

vSphere Lifecycle Manager (vLCM) downloads ESX images and patches from
four token-based URLs, all through vCenter's proxy. They replace the old
`vmware.com` / `hostupdate.vmware.com` sources. Leaving the old ones
configured causes the same failures, per
[KB 390098](https://knowledge.broadcom.com/external/article/390098).

```
https://dl.broadcom.com/<token>/PROD/COMP/ESX_HOST/main/vmw-depot-index.xml
https://dl.broadcom.com/<token>/PROD/COMP/ESX_HOST/addon-main/vmw-depot-index.xml
https://dl.broadcom.com/<token>/PROD/COMP/ESX_HOST/iovp-main/vmw-depot-index.xml
https://dl.broadcom.com/<token>/PROD/COMP/ESX_HOST/vmtools-main/vmw-depot-index.xml
```

- **Token:** generated in the Broadcom Support Portal. Only users with the
  **Product Administrator** role on the site can create one. The token is
  a secret; keep it out of tickets, screenshots and chat.
- **Where:** vSphere Client → **Lifecycle Manager → Settings →
  Administration → Patch Setup**. Afterwards the **Connectivity Status**
  column should read *Connected*. Also check that **Internet
  Connectivity** is *Enabled* (vCenter object → **Configure → Settings →
  General**).
- **These are host sources only.** Updating the vCenter appliance itself
  through VAMI uses its own URL (KB 390120).
- **The token also drifts** between SDDC Manager, Fleet Manager and
  vCenter; see the [field note](04-field-notes.md#entitlement-and-the-depot-download-token).

### Test the path first, from the vCenter shell

```
# Through vCenter's own local proxy (what vLCM uses)
curl -v -I https://dl.broadcom.com/ 2>&1 | grep -E "CONNECT|HTTP/|issuer|SSL certificate"

# Straight to the corporate proxy, skipping the local one
curl -v -I -x http://<proxy-host>:<port> https://dl.broadcom.com/ 2>&1 | grep -E "HTTP/|Proxy-Authenticate"

# The real depot index, with the token – expect HTTP 200
curl -v "https://dl.broadcom.com/<token>/PROD/COMP/ESX_HOST/main/vmw-depot-index.xml" -o /dev/null 2>&1 | grep -E "HTTP/"
```

If the filtered output is empty, curl failed before getting any response.
Re-run without the `grep` and read the last lines: `Connection refused`
on `localhost:1082` means the local proxy service itself isn't running
(see the [Field warning](#field-warning-a-hand-edited-configjson-can-break-the-proxy-service)).

| Result | Meaning | Fix |
| --- | --- | --- |
| Any `HTTP/…` status from Broadcom, even 403/404 on the bare host | Path works | – |
| `CONNECT tunnel failed, response 407` | Proxy wants authentication. If `-x` straight to the same proxy works, it's the local proxy on stale settings, not the corporate proxy (field-observed) | Check `Proxy-Authenticate:`; if the proxy uses none, restart or re-save the proxy config via VAMI |
| `CONNECT tunnel failed, response 403` | `dl.broadcom.com` not allowed on the proxy | Proxy allowlist |
| `CONNECT tunnel failed, response 502` | Proxy can't reach the destination | Proxy side; for an internal host, exclude it instead |
| Tries to connect directly, times out | No HTTPS proxy set. vLCM uses the HTTPS proxy for `https://` URLs and goes direct if it's empty ([KB 393951](https://knowledge.broadcom.com/external/article/393951)) | Fill in the HTTPS proxy, even when it's the same HTTP proxy |
| `wrong version number` | HTTPS proxy entered as `https://` but the proxy speaks plain HTTP ([KB 396787](https://knowledge.broadcom.com/external/article/396787/updating-url-with-token-in-vsphere-lifec.html)) | Scheme `http` for the HTTPS proxy entry |
| `self-signed certificate in certificate chain`, `issuer` is your own CA | Proxy does SSL inspection ([KB 396511](https://knowledge.broadcom.com/external/article/396511/failed-to-add-new-tokenbased-url-in-life.html)) | Exclude `dl.broadcom.com` from inspection |
| `HTTP 403` from Broadcom on the token URL | Bad or expired token, or no entitlement | New token; see the [field note](04-field-notes.md#entitlement-and-the-depot-download-token) |

The vLCM log shows which proxy it actually used:

```
grep -h -E "CURLOPT_PROXY|CURLOPT_NOPROXY|curl_easy_perform" /var/log/vmware/vmware-updatemgr/vum-server/vmware-vum-server*.log | tail -10
```

### Known issue: compatibility data (VCG) can't be updated behind a proxy

**Field-observed (2026-09-29, vCenter 9.1), matching a Broadcom known
issue.** With the download sources syncing fine, **Update compatibility
data** failed with:

> *A general system error occurred: "Unable to authenticate with the
> VMware Verification Service"*

[KB 438438](https://knowledge.broadcom.com/external/article/438438/generating-the-hardware-compatibility-re.html)
describes exactly this: *"There is an issue, when using a Proxy for the
vCenter, in an online environment. We can't download the VMware
Compatibility Guide - i.e. VCG, but we can update it via sync updates."*
Broadcom *"is planning to address the issue in a future release."* The
compatibility download first requests a login token from
`auth.esp.vmware.com` through the local proxy, and that request fails
(`503 no_healthy_upstream` in `/var/log/vmware/envoy/envoy-access*.log`),
even though `curl` from the shell reaches the same endpoints.

Confirm it's this and not a blocked endpoint:

```
grep -h "auth.esp.vmware.com" /var/log/vmware/envoy/envoy-access*.log | grep -i "no_healthy_upstream" | tail -3
for h in auth.esp.vmware.com vvs.esp.vmware.com vvs.broadcom.com storage.googleapis.com; do
  echo "== $h"; curl -s -o /dev/null -w "%{http_code}\n" https://$h/
done
```

A `000` for any host means that endpoint still has to be allowed on the
proxy/firewall
([KB 401192](https://knowledge.broadcom.com/external/article/401192/vcenter-update-compatibility-data-task-f.html)
lists `vvs.broadcom.com` and `storage.googleapis.com`; on VCF 9.1 also
from the VCF services runtime IP range).

**Workaround:** load the compatibility data by hand once, with the steps
in KB 438438 (adapted from KB 405839, the offline procedure). They read
the vLCM client ID and secret from
`/usr/lib/vmware-updatemgr/config/vvs-config.json`, fetch a token and the
bundle with `curl` (which, unlike the internal path, works through the
proxy), and import it with `hcl_datastore.py update-offline`. After that,
**Sync Updates** keeps the data current. The client secret is a
credential – don't paste it anywhere.

> **Not applied in the field case** (left for later), so the workaround
> is untested here. KB 401192 advises a snapshot or file-level backup of
> vCenter first. What's lost without it: hardware compatibility checks
> and reports in vLCM. Image and patch downloads are not affected.

---

## Verifying the proxy is actually reachable

Independent of which method configured it, confirm the appliance can
reach the internet **through the proxy itself** before assuming an
upgrade-blocking connectivity issue is something else. Per KB 373713,
from an SSH session on the appliance:

```
HTTP_PROXY="http://<proxy-host>:<port>/" curl -I http://example.com
HTTPS_PROXY="https://<proxy-host>:<port>/" curl -I https://example.com
wget --spider http://example.com
https_proxy="http://<proxy-host>:<port>/" wget --spider https://example.com
```

These test whether the *proxy server itself* is reachable and forwarding
correctly – a clean result here doesn't by itself confirm vCenter's own
app-level config (`config.json` on 9.x, `/etc/sysconfig/proxy` on
7.0.x/8.0.x) is being read correctly, only that the proxy is a working
path if the appliance is pointed at it.

---

## Sources

- [How to configure proxy settings for vCenter Server](https://knowledge.broadcom.com/external/article/370265/how-to-configure-proxy-settings-for-vcen.html) – VAMI GUI and `/etc/sysconfig/proxy` methods, 7.0.x/8.0.x
- ["HTTP Cannot connect to proxy server" when configuring a proxy in vCenter VAMI UI](https://knowledge.broadcom.com/external/article/402684/http-cannot-connect-to-proxy-server-when.html) – the 9.x `config.json` method and the VAMI UI's known validation failure
- [Troubleshooting vCenter Server Proxy Configuration](https://knowledge.broadcom.com/external/article/373713/troubleshooting-vcenter-server-proxy-con.html) – the `wget` vs. `curl` distinction and the `curl`/`wget` reachability test commands, vCenter Server 7.0 and later
- [Authenticated downloads configuration update instructions (KB 390098)](https://knowledge.broadcom.com/external/article/390098) – which KB covers which product's token-based URLs; old `vmware.com` sources cause the same failures
- ["The download source (...) is invalid or cannot be reached now" during the token update (KB 393951)](https://knowledge.broadcom.com/external/article/393951) – vLCM uses the HTTPS proxy setting for `https://` URLs
- [Updating URL with token in vSphere Lifecycle Manager fails (KB 396787)](https://knowledge.broadcom.com/external/article/396787/updating-url-with-token-in-vsphere-lifec.html) – `wrong version number` from an `https://` scheme on an HTTP-only proxy
- [Failed to add new token-based URL in Lifecycle Manager (KB 396511)](https://knowledge.broadcom.com/external/article/396511/failed-to-add-new-tokenbased-url-in-life.html) – SSL inspection on the proxy
- [Generating the hardware compatibility report via the vCenter GUI is failing when a Proxy is in use (KB 438438)](https://knowledge.broadcom.com/external/article/438438/generating-the-hardware-compatibility-re.html) – the VCG known issue and its online workaround
- [vCenter Update Compatibility Data task fails (KB 401192)](https://knowledge.broadcom.com/external/article/401192/vcenter-update-compatibility-data-task-f.html) – endpoints the compatibility data needs
