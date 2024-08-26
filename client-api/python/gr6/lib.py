"""
todo разобраться с импортированием етой либы.. типа import ppk.gr6.lib надо
т.е. чтобы само ppk его не загружало
"""

import asyncio
import ppk
import ppk_main
import os
import time
import sys
import atexit
import subprocess
import numpy as np
import math

import ctypes
import signal
def _set_pdeathsig(sig=signal.SIGTERM):
    """help function to ensure once parent process exits, its childrent processes will automatically die
    """
    def callable():
        libc = ctypes.CDLL("libc.so.6")
        return libc.prctl(1, sig)
    return callable


async def start_visual(ppk_url):
    await start_repr(ppk_url)
    await start_browser(ppk_url)
    
async def start_repr(url):
    # subprocess.popen уместнее было бы
    env = os.environ.copy() | {"PPK_URL":url} 
    cmd = os.path.join( os.path.dirname(__file__), "../../../repr-ws.sh" )
 
    p = await asyncio.create_subprocess_exec(cmd,env=env, preexec_fn=_set_pdeathsig(signal.SIGTERM) )
        #preexec_fn=lambda: prctl.set_pdeathsig(signal.SIGKILL))
    def cleanup():
        print("repr cleanup")
        if p.returncode is None:
            print("repr term")
            p.terminate()
            time.sleep(0.1)
    atexit.register(cleanup)
    return p

async def start_browser(url):
    # subprocess.popen уместнее было бы
    env = os.environ.copy() | {"PPK_URL":url}    
    cwd = os.path.dirname(__file__)
    cmd = os.path.join( cwd, "./web-dev.cl" )
    p = await asyncio.create_subprocess_exec(cmd,env=env, cwd=cwd,preexec_fn=_set_pdeathsig(signal.SIGTERM))
    def cleanup():
        print("webdev cleanup")
        if p.returncode is None:
            print("webdev term")
            p.terminate()
            time.sleep(0.1)
    atexit.register(cleanup)
    return p
    