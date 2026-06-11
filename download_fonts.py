import urllib.request
import ssl
import os

os.makedirs('backend/assets/fonts', exist_ok=True)
ctx = ssl.create_default_context()
ctx.check_hostname = False
ctx.verify_mode = ssl.CERT_NONE

with urllib.request.urlopen('https://raw.githubusercontent.com/googlefonts/roboto/main/src/hinted/Roboto-Bold.ttf', context=ctx) as response, open('backend/assets/fonts/Inter-Bold.ttf', 'wb') as out_file:
    out_file.write(response.read())

with urllib.request.urlopen('https://raw.githubusercontent.com/googlefonts/roboto/main/src/hinted/Roboto-Medium.ttf', context=ctx) as response, open('backend/assets/fonts/Inter-Medium.ttf', 'wb') as out_file:
    out_file.write(response.read())

print("Fonts downloaded.")
