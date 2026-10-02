JEV / router_agent — Windows and Android

Windows: double-click Launch-JEV.cmd. A bundled Node.js runtime starts JEV;
Chrome or Edge opens it in an app window. Closing the window leaves the service
available to the phone. Stop-JEV.ps1 stops only this package's service.

Ollama must be running on this computer with an installed model. The package
does not include model weights. Codex and Claude executors are not configured.

Android: connect through your existing authenticated remote connection, open
the app's HTTPS address in Chrome, and choose Install app / Add to Home screen.
This is an installable web app, not an APK. It needs a network connection and
the computer running JEV and Ollama. Task history stays in each browser.

The service listens only on this computer. Before connecting a trusted HTTPS
tunnel, create remote.json beside server.mjs with {"url":"https://your-address"}
and restart JEV. The tunnel must forward to http://127.0.0.1:8082 and enforce
authentication/access controls. Do not publish an unauthenticated public link.

Remote access and physical Android installation require device/account access
and have not been verified merely by testing the mobile browser layout.

The included runtime license is in runtime/LICENSE.
