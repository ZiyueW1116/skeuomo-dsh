"""构建依赖当前源码目录的本机应用，不修改已安装的 Harness。"""
from pathlib import Path
import plistlib
import shutil
import subprocess
import tempfile

root = Path(__file__).resolve().parents[2]
bundle = root.parent / '深潜书桌.app'
contents = bundle / 'Contents'
(contents / 'MacOS').mkdir(parents=True, exist_ok=True)
(contents / 'Resources').mkdir(exist_ok=True)
node = shutil.which('node')
if not node:
    raise SystemExit('需要已安装的 Node.js')
with (contents / 'Info.plist').open('wb') as file:
    plistlib.dump({
        'CFBundleIdentifier': 'local.deepseek.study',
        'CFBundleName': '深潜书桌', 'CFBundleDisplayName': '深潜书桌',
        'CFBundleExecutable': 'Study', 'CFBundlePackageType': 'APPL',
        'CFBundleShortVersionString': '1.0', 'CFBundleVersion': '1',
        'CFBundleDevelopmentRegion': 'zh-Hans', 'CFBundleLocalizations': ['zh-Hans'],
        'CFBundleIconFile': 'Study.icns',
        'LSMinimumSystemVersion': '13.0', 'NSHighResolutionCapable': True,
        'StudyProjectDirectory': str(root), 'StudyNodeExecutable': node,
        'NSMicrophoneUsageDescription': '使用语音输入时录制你的语音。',
        'NSAppTransportSecurity': {'NSAllowsLocalNetworking': True},
    }, file)
subprocess.run(['swiftc', str(root / 'scripts/study-macos/Study.swift'), '-o', str(contents / 'MacOS/Study'), '-framework', 'AppKit', '-framework', 'WebKit'], check=True)
with tempfile.TemporaryDirectory(prefix='study-icon-') as temporary:
    temporary = Path(temporary)
    iconset = temporary / 'Study.iconset'
    iconset.mkdir()
    source = temporary / 'source.png'
    subprocess.run(['swift', str(root / 'scripts/study-macos/Icon.swift'), str(source)], check=True)
    for size in [16, 32, 128, 256, 512]:
        for scale in [1, 2]:
            name = f'icon_{size}x{size}' + ('@2x' if scale == 2 else '') + '.png'
            subprocess.run(['sips', '-z', str(size * scale), str(size * scale), str(source), '--out', str(iconset / name)], check=True, stdout=subprocess.DEVNULL)
    subprocess.run(['iconutil', '-c', 'icns', str(iconset), '-o', str(contents / 'Resources/Study.icns')], check=True)
subprocess.run(['codesign', '--force', '--sign', '-', str(bundle)], check=True)
print(bundle)
