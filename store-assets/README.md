# Store assets

Everything here is generated — do not edit the images by hand.

| File | For |
|---|---|
| `play-icon-512.png` | Play Console → App icon |
| `feature-graphic-1024x500.png` | Play Console → Feature graphic |
| `screenshots/` | Phone screenshots, 1080 × 1920 |
| `screenshots-tablet7/` | 7-inch tablet, 1200 × 1920 |
| `screenshots-tablet10/` | 10-inch tablet, 1600 × 2560 |
| `raw-screens/`, `raw-screens-tablet/` | Real captures of the app that the images are built from |

To refresh after the screens change:

```
node tools/captureStoreScreens.mjs   # real app + demo data → raw screens
node tools/makeStoreAssets.mjs       # headlines + frames → listing images
node tools/makeStoreListing.mjs      # listing text → docs/playstore-listing.md
```

Headlines and their order are in `tools/makeStoreAssets.mjs` (`SHOTS`).
