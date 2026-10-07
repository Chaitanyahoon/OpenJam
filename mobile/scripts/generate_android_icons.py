import os
from PIL import Image, ImageDraw

def main():
    mark = Image.open('mobile/assets/images/openjam_mark_transparent.png')
    
    # White monochrome mark
    mark_mono = Image.new('RGBA', mark.size)
    mono_pixels = [(255, 255, 255, a) for _, _, _, a in mark.getdata()]
    mark_mono.putdata(mono_pixels)

    BG_COLOR = (13, 15, 20, 255) # Sleek obsidian dark #0d0f14

    densities = {
        'mdpi': {
            'canvas_adaptive': 108,
            'mark_w_adaptive': 50,
            'offset_y_adaptive': 2,
            'canvas_legacy': 48,
            'mark_w_legacy': 28,
            'offset_y_legacy': 1,
            'splash_canvas': 288,
            'splash_mark_w': 140,
            'splash_offset_y': 5,
            'apk_files': {
                'ic_launcher': 'res/d2.webp',
                'ic_launcher_round': 'res/yw.webp',
                'ic_launcher_background': 'res/At.webp',
                'ic_launcher_foreground': 'res/Nt.webp',
                'ic_launcher_monochrome': 'res/_l.webp',
                'splashscreen_logo': 'res/gV.png',
            }
        },
        'hdpi': {
            'canvas_adaptive': 162,
            'mark_w_adaptive': 75,
            'offset_y_adaptive': 3,
            'canvas_legacy': 72,
            'mark_w_legacy': 42,
            'offset_y_legacy': 2,
            'splash_canvas': 432,
            'splash_mark_w': 210,
            'splash_offset_y': 8,
            'apk_files': {
                'ic_launcher': 'res/MO.webp',
                'ic_launcher_round': 'res/fq.webp',
                'ic_launcher_background': 'res/4k.webp',
                'ic_launcher_foreground': 'res/13.webp',
                'ic_launcher_monochrome': 'res/mJ.webp',
                'splashscreen_logo': 'res/Zt.png',
            }
        },
        'xhdpi': {
            'canvas_adaptive': 216,
            'mark_w_adaptive': 100,
            'offset_y_adaptive': 4,
            'canvas_legacy': 96,
            'mark_w_legacy': 56,
            'offset_y_legacy': 2,
            'splash_canvas': 576,
            'splash_mark_w': 280,
            'splash_offset_y': 10,
            'apk_files': {
                'ic_launcher': 'res/qs.webp',
                'ic_launcher_round': 'res/u5.webp',
                'ic_launcher_background': 'res/By.webp',
                'ic_launcher_foreground': 'res/9Q.webp',
                'ic_launcher_monochrome': 'res/Yu.webp',
                'splashscreen_logo': 'res/42.png',
            }
        },
        'xxhdpi': {
            'canvas_adaptive': 324,
            'mark_w_adaptive': 150,
            'offset_y_adaptive': 6,
            'canvas_legacy': 144,
            'mark_w_legacy': 84,
            'offset_y_legacy': 3,
            'splash_canvas': 864,
            'splash_mark_w': 420,
            'splash_offset_y': 15,
            'apk_files': {
                'ic_launcher': 'res/Sn.webp',
                'ic_launcher_round': 'res/j_.webp',
                'ic_launcher_background': 'res/BZ.webp',
                'ic_launcher_foreground': 'res/iE.webp',
                'ic_launcher_monochrome': 'res/ae.webp',
                'splashscreen_logo': 'res/St.png',
            }
        },
        'xxxhdpi': {
            'canvas_adaptive': 432,
            'mark_w_adaptive': 200,
            'offset_y_adaptive': 8,
            'canvas_legacy': 192,
            'mark_w_legacy': 112,
            'offset_y_legacy': 4,
            'splash_canvas': 1152,
            'splash_mark_w': 560,
            'splash_offset_y': 20,
            'apk_files': {
                'ic_launcher': 'res/sK.webp',
                'ic_launcher_round': 'res/-6.webp',
                'ic_launcher_background': 'res/gS.webp',
                'ic_launcher_foreground': 'res/5c.webp',
                'ic_launcher_monochrome': 'res/IG.webp',
                'splashscreen_logo': 'res/S7.png',
            }
        },
    }

    apk_staging_dir = 'mobile/dist/apk_injection'
    os.makedirs(os.path.join(apk_staging_dir, 'res'), exist_ok=True)

    for density, conf in densities.items():
        res_mipmap_dir = f'mobile/android/app/src/main/res/mipmap-{density}'
        res_drawable_dir = f'mobile/android/app/src/main/res/drawable-{density}'
        os.makedirs(res_mipmap_dir, exist_ok=True)
        os.makedirs(res_drawable_dir, exist_ok=True)

        ca = conf['canvas_adaptive']
        mwa = conf['mark_w_adaptive']
        mha = int(mark.height * (mwa / mark.width))
        moya = conf['offset_y_adaptive']
        rmark_ad = mark.resize((mwa, mha), Image.Resampling.LANCZOS)
        rmono_ad = mark_mono.resize((mwa, mha), Image.Resampling.LANCZOS)

        # 1. Foreground
        fg = Image.new('RGBA', (ca, ca), (0, 0, 0, 0))
        fg_px = (ca - mwa) // 2
        fg_py = (ca - mha) // 2 + moya
        fg.paste(rmark_ad, (fg_px, fg_py), rmark_ad)
        fg.save(f'{res_mipmap_dir}/ic_launcher_foreground.webp', 'WEBP')
        fg.save(f'{apk_staging_dir}/{conf["apk_files"]["ic_launcher_foreground"]}', 'WEBP')

        # 2. Background
        bg = Image.new('RGBA', (ca, ca), BG_COLOR)
        bg.save(f'{res_mipmap_dir}/ic_launcher_background.webp', 'WEBP')
        bg.save(f'{apk_staging_dir}/{conf["apk_files"]["ic_launcher_background"]}', 'WEBP')

        # 3. Monochrome
        mono = Image.new('RGBA', (ca, ca), (0, 0, 0, 0))
        mono.paste(rmono_ad, (fg_px, fg_py), rmono_ad)
        mono.save(f'{res_mipmap_dir}/ic_launcher_monochrome.webp', 'WEBP')
        mono.save(f'{apk_staging_dir}/{conf["apk_files"]["ic_launcher_monochrome"]}', 'WEBP')

        # 4. Legacy ic_launcher (rounded rectangle)
        cl = conf['canvas_legacy']
        mwl = conf['mark_w_legacy']
        mhl = int(mark.height * (mwl / mark.width))
        moyl = conf['offset_y_legacy']
        rmark_leg = mark.resize((mwl, mhl), Image.Resampling.LANCZOS)

        leg_icon = Image.new('RGBA', (cl, cl), (0, 0, 0, 0))
        leg_draw = ImageDraw.Draw(leg_icon)
        leg_draw.rounded_rectangle((0, 0, cl, cl), radius=int(cl * 0.22), fill=BG_COLOR)
        lpx = (cl - mwl) // 2
        lpy = (cl - mhl) // 2 + moyl
        leg_icon.paste(rmark_leg, (lpx, lpy), rmark_leg)
        leg_icon.save(f'{res_mipmap_dir}/ic_launcher.webp', 'WEBP')
        leg_icon.save(f'{apk_staging_dir}/{conf["apk_files"]["ic_launcher"]}', 'WEBP')

        # 5. Legacy ic_launcher_round (circle)
        leg_round = Image.new('RGBA', (cl, cl), (0, 0, 0, 0))
        round_draw = ImageDraw.Draw(leg_round)
        round_draw.ellipse((0, 0, cl, cl), fill=BG_COLOR)
        leg_round.paste(rmark_leg, (lpx, lpy), rmark_leg)
        leg_round.save(f'{res_mipmap_dir}/ic_launcher_round.webp', 'WEBP')
        leg_round.save(f'{apk_staging_dir}/{conf["apk_files"]["ic_launcher_round"]}', 'WEBP')

        # 6. Splashscreen logo
        sc = conf['splash_canvas']
        smw = conf['splash_mark_w']
        smh = int(mark.height * (smw / mark.width))
        smoy = conf['splash_offset_y']
        smark = mark.resize((smw, smh), Image.Resampling.LANCZOS)
        splash_im = Image.new('RGBA', (sc, sc), (0, 0, 0, 0))
        spx = (sc - smw) // 2
        spy = (sc - smh) // 2 + smoy
        splash_im.paste(smark, (spx, spy), smark)
        splash_im.save(f'{res_drawable_dir}/splashscreen_logo.png', 'PNG')
        splash_im.save(f'{apk_staging_dir}/{conf["apk_files"]["splashscreen_logo"]}', 'PNG')

        print(f'Processed density: {density}')

    # Generate bundled emblem drawable res/IG.png
    emblem_canvas = 664
    emblem_w = 480
    emblem_h = int(mark.height * emblem_w / mark.width)
    rmark_emblem = mark.resize((emblem_w, emblem_h), Image.Resampling.LANCZOS)
    emblem_im = Image.new('RGBA', (emblem_canvas, emblem_canvas), (0, 0, 0, 0))
    emblem_im.paste(rmark_emblem, ((emblem_canvas - emblem_w) // 2, (emblem_canvas - emblem_h) // 2 + 10), rmark_emblem)
    emblem_im.save(f'{apk_staging_dir}/res/IG.png', 'PNG')

    print('All density icons and APK injection resources generated successfully!')

if __name__ == '__main__':
    main()
