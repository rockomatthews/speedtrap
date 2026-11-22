# Race Control pilot — operator guide

## Try it in a browser

Open **rFactor 2 desk** in the isolated Race Control preview after Vercel sign-in. The browser demo starts with four simulated seats and requires no venue key or Windows installation. Select one or more seats, enter driver names, and choose **Start selected rigs**. The seats wait for **Driver on track**. Confirm one seat and verify that only its timer starts. Rotate the driver, add five minutes, and finish the seat. Reloading resets the simulation. Demo actions make no rig commands and write no customer data.

## Try one Windows rig on-site

1. Extract the Windows pilot ZIP. The installer and executable in this test build are unsigned. Use the package from the test branch and follow the venue's software approval process. The pilot can be restricted to one idle rig for acceptance testing.
2. In the competition test site's Organizer controls, issue a credential with provider **desk** for a test venue. Open **Connect real rigs** in the rFactor 2 desk view, enter that venue credential, and request a fresh pairing code.
3. Install the **Rig** role in the signed-in Windows account that runs rFactor 2: run `Install-SpeedTrap.ps1 -Role Rig -Cloud`. Enter the isolated preview's HTTPS origin and the pairing code. Select `rf2-practice` only after confirming the Steam install, wheel, pedals, car and track work. Use a fresh configuration directory or preserve the existing Rig config and create a separate cloud config for testing.
4. The hosted pilot retains Vercel Deployment Protection. An unattended Windows rig needs a separately authorized test automation credential set through the Windows environment as `RACE_PREVIEW_BYPASS` before starting the worker. Use a test-project credential scoped to the test preview, and remove it after the hardware pilot. A desk key authorizes venue operations within the app; it does not authenticate the rig to Vercel. The existing LAN Desk/Rig option remains available for the first hardware test when protected-preview automation access is unavailable.
5. From the desk, assign the driver and start `rf2-practice`. If rFactor 2 is closed, the worker asks Steam to open it. If it is already running, the worker leaves that game running. On the rig select **Single Player**, use the verified car and layout, load the session and press **Drive**. From the cloud desk, choose **Driver on track** after seeing the correct car and track. That starts the timed seat.
6. For a rotation, physically hand off the rig and update the name. For a finish, exit Drive, then confirm **Finish seat**. During a WAN drop the game keeps running locally. Watch the clock locally and reconcile the session once the desk reconnects. The pilot has no remote stop or paid-reservation enforcement.

## What to log

Test a cold start, a warm client, the wrong car or track, no launch acknowledgment, a brief internet drop, two drivers sharing a seat, and four separate solo sessions. Include rig name, rFactor 2 build, Windows build, car and track layout IDs, timestamps for Launch / Loaded / Drive, controller results, and any manual steps. Keep real names and credentials out of test evidence.

For race results, use the native rFactor 2 XML export and the test competition workflow described in the main README. The operator reviews driver identity and settings before publishing. An XML fixture verifies parsing, while an actual game export must pass the same check on-site.
