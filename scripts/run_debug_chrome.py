import os
import subprocess
import time
import shutil

localappdata = os.environ.get('LOCALAPPDATA', '')
debug_dir = os.path.join(localappdata, 'Google', 'Chrome', 'DebugProfile')
os.makedirs(debug_dir, exist_ok=True)

chrome_path = r'C:\Program Files\Google\Chrome\Application\chrome.exe'
cmd = [
    chrome_path,
    '--remote-debugging-port=0',
    '--remote-allow-origins=*',
    f'--user-data-dir={debug_dir}',
    '--no-first-run',
    'about:blank'
]

print("Launching Chrome...")
proc = subprocess.Popen(cmd)
print("Chrome PID:", proc.pid)

debug_port_file = os.path.join(debug_dir, 'DevToolsActivePort')
user_data_port_file = os.path.join(localappdata, 'Google', 'Chrome', 'User Data', 'DevToolsActivePort')

for _ in range(30):
    time.sleep(1)
    if os.path.exists(debug_port_file):
        try:
            shutil.copyfile(debug_port_file, user_data_port_file)
            print("Successfully copied DevToolsActivePort!")
            print(open(user_data_port_file).read())
            break
        except Exception as e:
            print("Copy error:", e)

# Keep running to hold the process
proc.wait()
