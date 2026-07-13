import os, sys
f = "mp/manifest.json"
if os.path.exists(f):
    with open(f, "r", encoding="utf-8") as fh:
        c = fh.read()
    new_c = c.replace("YOUR_APPID", "YOUR_APPID")
    if c != new_c:
        with open(f, "w", encoding="utf-8") as fh:
            fh.write(new_c)
        print("fixed")
