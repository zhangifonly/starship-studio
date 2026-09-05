# Third-Party Notices

The MIT license in this repository covers the project's original source code,
procedural educational models, narration scripts and documentation. It does not
relicense SpaceX designs, third-party media, trademarks or hosted services.

## Dependencies

React, Three.js and Vite use MIT licenses. Lucide uses ISC; TypeScript and
Playwright use Apache-2.0. Dependency versions are locked in `package-lock.json`.
Consult each installed package's license for its full terms and notices.

## Earth Imagery

- `public/textures/earth-day.jpg`: NASA / Visible Earth, Blue Marble composite.
  Source and resizing are recorded in `public/textures/README.md`. NASA imagery
  is subject to NASA's media usage guidelines, not this project's MIT grant:
  https://www.nasa.gov/nasa-brand-center/images-and-media/ . No endorsement implied.
- Cloud and specular maps: unchanged Three.js r159 example assets. Original
  source URLs are in `public/textures/README.md`; the upstream MIT notice is
  retained at `public/textures/THREE-LICENSE.txt`.

## Materials Not Distributed

- The FAA-hosted PDF, extracted diagram and page raster contain SpaceX proprietary
  notices. They are excluded from Git. The application links to the original FAA
  source when local reference files are absent. Public availability is not an
  open-design license. See `REFERENCES.md`.
- Generated Microsoft Edge TTS MP3s are excluded because redistribution terms
  have not been established. The original Chinese text, settings, manifest and
  generator are included. Users must review applicable Microsoft service terms
  before generating or distributing audio. Generated output is not relicensed
  by this project's MIT license; `edge-tts` is an unofficial service client.
- The separate Model X Studio source, Tesla model and BlendKit assets are not
  included. Model X Studio inspired the interaction concept; this project does
  not grant any license to that project or its assets.
- Internal deployment records, SSH settings, credentials and local build/test
  artifacts are excluded from the public repository.

SpaceX, Starship, Raptor and other names belong to their respective owners. This
independent educational project is not affiliated with or endorsed by SpaceX.
