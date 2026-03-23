import yt_dlp
import shutil
import sys
import argparse
import os
import platform

if sys.platform == 'win32':
    import io
    sys.stdout = io.TextIOWrapper(sys.stdout.buffer, encoding='utf-8', errors='replace')
    sys.stderr = io.TextIOWrapper(sys.stderr.buffer, encoding='utf-8', errors='replace')

IS_WINDOWS = sys.platform == 'win32'
IS_MACOS   = sys.platform == 'darwin'


def progress_hook(d):
    if d['status'] == 'downloading':
        p = d.get('_percent_str', '0%').replace('%', '').strip()
        try:
            print(f"PROGRESS:{p}")
            sys.stdout.flush()
        except Exception:
            pass


def download(url, mode, quality, output_dir):
    script_dir = os.path.dirname(os.path.abspath(sys.executable if getattr(sys, 'frozen', False) else __file__))
    ffmpeg_name = "ffmpeg.exe" if IS_WINDOWS else "ffmpeg"
    bundled_ffmpeg = os.path.join(script_dir, ffmpeg_name)

    ffmpeg_path = bundled_ffmpeg if os.path.exists(bundled_ffmpeg) else shutil.which("ffmpeg")
    ffmpeg_exists = ffmpeg_path is not None

    if ffmpeg_exists:
        print(f"DEBUG: Using FFmpeg at {ffmpeg_path}")
    else:
        print("DEBUG: FFmpeg NOT FOUND. Quality and formats will be limited.")

    base_opts = {
        'outtmpl': os.path.join(output_dir, '%(title)s.%(ext)s'),
        'progress_hooks': [progress_hook],
        'restrictfilenames': True,     
        'noplaylist': True,              
        'quiet': True,                  
        'no_warnings': True,
        'ffmpeg_location': ffmpeg_path if ffmpeg_exists else None, 
    }

    if IS_WINDOWS:
        base_opts['windowsfilenames'] = True

    if mode == 'mp3':
        ydl_opts = {
            **base_opts,
            'format': 'bestaudio/best',
        }
        if ffmpeg_exists:
            ydl_opts['postprocessors'] = [{
                'key': 'FFmpegExtractAudio',
                'preferredcodec': 'mp3',
                'preferredquality': '192',
            }]
    else:
        quality_map = {
            'best': 'bestvideo[vcodec^=avc1]+bestaudio[acodec^=mp4a]/bestvideo[vcodec^=avc1]+bestaudio/best[ext=mp4]/best',
            '1080': 'bestvideo[vcodec^=avc1][height<=1080]+bestaudio[acodec^=mp4a]/bestvideo[vcodec^=avc1][height<=1080]+bestaudio/best[ext=mp4][height<=1080]/best',
            '720':  'bestvideo[vcodec^=avc1][height<=720]+bestaudio[acodec^=mp4a]/bestvideo[vcodec^=avc1][height<=720]+bestaudio/best[ext=mp4][height<=720]/best',
            '480':  'bestvideo[vcodec^=avc1][height<=480]+bestaudio[acodec^=mp4a]/bestvideo[vcodec^=avc1][height<=480]+bestaudio/best[ext=mp4][height<=480]/best',
        }

        ydl_opts = {
            **base_opts,
            'format': quality_map.get(quality, quality_map['best']),
            'merge_output_format': 'mp4',
        }

        if ffmpeg_exists:
            ydl_opts['postprocessors'] = [{
                'key': 'FFmpegVideoConvertor',
                'preferedformat': 'mp4',
            }]
            ydl_opts['postprocessor_args'] = {
                'FFmpegVideoConvertor': ['-c:v', 'libx264', '-c:a', 'aac', '-preset', 'fast', '-crf', '18']
            }
        else:
            ydl_opts['format'] = 'best[ext=mp4][vcodec^=avc1]/best[ext=mp4]/best'

    try:
        with yt_dlp.YoutubeDL(ydl_opts) as ydl:
            info = ydl.extract_info(url, download=True)
            filename = ydl.prepare_filename(info)

            if mode == 'mp3':
                filename = os.path.splitext(filename)[0] + ".mp3"
            elif not filename.endswith('.mp4'):
                filename = os.path.splitext(filename)[0] + ".mp4"

            print(f"SUCCESS:{filename}")
            sys.stdout.flush()
    except Exception as e:
        print(f"ERROR:{str(e)}")
        sys.stdout.flush()


if __name__ == "__main__":
    parser = argparse.ArgumentParser()
    parser.add_argument("--url")
    parser.add_argument("--mode")      
    parser.add_argument("--quality")  
    parser.add_argument("--out")       

    args = parser.parse_args()

    if args.url and args.out:
        download(args.url, args.mode, args.quality, args.out)
