#!/bin/env python3

import asyncio
import traceback
import ppk
import os
import time
import sys  
import atexit
import subprocess
import ppk.genesis as gen
import plugins.voxel
#import plugins.voxel_paint_open3d as voxpaint
#import plugins.voxel_paint_pyvista as voxpaint
#import plugins.voxel_paint_vispy as voxpaint
import plugins.voxel_paint_sw as voxpaint

import plugins.life
import plugins.common

def on_worker_msg(msg):
    print("msg from worker: ",msg)

async def start_worker_process(url, worker_id, input_channel_id, output_channel_id,logdir):
    env = os.environ.copy() | {"PPK_INPUT_CHANNEL":input_channel_id,"PPK_REPORT_CHANNEL":output_channel_id,"PPK_URL":url}
    log = os.open(f"{logdir}/{worker_id}.log",os.O_WRONLY | os.O_CREAT,0o644)
    logerr = os.open(f"{logdir}/{worker_id}.err.log",os.O_WRONLY | os.O_CREAT,0o644)

    # subprocess.popen уместнее было бы
    p = await asyncio.create_subprocess_exec(sys.executable,"./genesis_worker.py",env=env,stdin=subprocess.DEVNULL,stderr=logerr,stdout=log)
    def cleanup():        
        if p.returncode is None:
            p.terminate()
    atexit.register(cleanup)
    return p


"""
создает ссылку из объекта A пучка .x в гиперметку B
update тогда уж в набор B?
update проще сделать уж тогда сразу набор, { channel_id -> ... }
"""
def hyper_link_out( object, channel_id, target_label ):
    distr = object.distribution
    cnt = 0
    for d in distr:
        worker_channel = d[0]
        object_id = d[1]
        partial_target_label = f"{target_label}_{cnt}"
        u = { "links_out": {channel_id:[partial_target_label]}}
        worker_channel.put( {"description":u,"id":object_id, "action":"update"} )
        cnt = cnt + 1

"""
создает ссылку в объекта A пучок .x из гиперметки B
"""
def hyper_link_in( object, channel_id, target_label ):
    distr = object.distribution
    cnt = 0
    for d in distr:
        worker_channel = d[0]
        object_id = d[1]        
        partial_target_label = f"{target_label}_{cnt}"
        u = { "links_in": {channel_id:[partial_target_label]}}
        worker_channel.put( {"description":u,"id":object_id, "action":"update"} )
        cnt = cnt + 1

#создает ссылку в объекта A пучок .x/y из гиперметки B
def interleave_hyper_link_in( object, channel_id, channel_id_2, target_label):
    distr = object.distribution
    cnt = 0
    for d in distr:
        worker_channel = d[0]
        object_id = d[1]        
        partial_target_label = f"{target_label}_{cnt}"
        if cnt % 2 == 0:
            u = { "links_in": {channel_id:[partial_target_label]}}
        else:
            u = { "links_in": {channel_id_2:[partial_target_label]}}
        worker_channel.put( {"description":u,"id":object_id, "action":"update"} )
        cnt = cnt + 1

"""
создает ссылку в объекта A пучка .x из простой метки B
"""
def single_hyper_link_in( object, channel_id, target_label ):
    distr = object.distribution
    cnt = 0
    for d in distr:
        worker_channel = d[0]
        object_id = d[1]        
        u = { "links_in": {channel_id:[target_label]}}
        worker_channel.put( {"description":u,"id":object_id, "action":"update"} )
        cnt = cnt + 1

# todo
#class WorkerStater:
#  def __init__(self):

# возвращает пачку объектов каналов для передачи сообщений воркерам
# todo refactor to run single .sh
async def start_workers( rapi, request_prefix, task_count, cpu_per_task_count ):
    workers_output_channel = rapi.channel("worker_outputs")
    workers_output_channel.react( on_worker_msg )

    worker_cnt = 0
    total_cnt = task_count * cpu_per_task_count
    worker_wait = asyncio.Future()
    def worker_attached( msg ):
        nonlocal worker_cnt, worker_wait
        worker_cnt = worker_cnt + 1
        if worker_cnt == total_cnt:
            worker_wait.set_result(1)
    workers_output_channel.react( worker_attached )

    worker_channels = []
    if not os.path.exists("log"):
       os.mkdir("log",0o755)
    for t in range(task_count):
        for x in range(cpu_per_task_count):
            worker_id = f"wrk_{request_prefix}_{t}_{x}"
            ch = rapi.channel( worker_id ) #.cell()
            #ch.put( [11,12,13,14,15] )
            worker_channels.append(ch)
            await start_worker_process( rapi.server_url, worker_id, ch.id, workers_output_channel.id,"log" )

    print("start_workers: waiting workers to start...")
    await worker_wait 
    print("start_workers: workers started")
    return worker_channels

async def main():
    rapi = ppk.Client()
    s = ppk.main.EmbeddedServer()
    print("starting system")
    s1 = await s.start()
    print("system started, connecting")
    s_urls = s.urls_future.result()
    
    t1 = await rapi.connect( url=s_urls[0] )
    print("connected",t1)

    worker_channels = await start_workers( rapi, "A", 1, 4 )

    """ 
    #test
    nodes = gen.node( "print", text="privet",links_in={"input":["a1"]} )
    worker_channels[0].put( {"description":nodes})
    nodes = gen.node( "timer", links_out={"output":["a1"]} )
    worker_channels[1].put( {"description":nodes})
    """

    ####################################
    print("Start main code")
    #aaa
    #raise ValueError
    print("Start main code 2")
    try:
        
        shape = [4,4,4]
        vv = plugins.voxel.VoxelVolume( size=10,shape=shape )
        init = plugins.life.RandomVoxels( shape=shape )
        gamestep = plugins.life.GameOfLife3D( shape=shape )
        pass_data = plugins.common.Pass3D( shape=shape,n=1000*1000 )
        paint = voxpaint.VoxelVolumePaint( size=10,shape=shape )
        #paint = voxpaint.VoxelVolumePaint( size=10,shape=shape )
        merge = voxpaint.ImageMergeSimple( total=shape[0]*shape[1]*shape[2])

        print("deploy")
        # надо отметить что это всегда забывается
        vv.deploy( worker_channels )
        init.deploy( worker_channels )
        gamestep.deploy( worker_channels )
        pass_data.deploy( worker_channels )
        paint.deploy( worker_channels )
        merge.deploy( worker_channels )
        print("deployed")

        """
          start -> ПАМЯТЬ -> D0 -> init -> D1 -> gamestep -> D2
                       D2 -> paint
                       D2 -> pass_data -> D1
        """

        hyper_link_out( vv,"output","D0")
        hyper_link_in( init,"input","D0")
        hyper_link_out( init,"output","D1")
        hyper_link_in( gamestep,"input","D1")
        single_hyper_link_in( vv, "input","start")

        hyper_link_out( gamestep,"output","D2")
        hyper_link_in( pass_data,"input","D2")
        hyper_link_out( pass_data,"output","D1")

        hyper_link_in( paint,"input","D2")
        hyper_link_out( paint,"output","D3")
        hyper_link_in( merge,"input","D3")

        start = rapi.channel("start")
        print("starting")
        start.put(1)

    except Exception as e:
        print(f"Caught an exception in my_coroutine: {e}")  
        traceback.print_exc()        

    ####################################

    print("done, waiting forever")
    await asyncio.Future()
 
    print("Exiting")
    await c.exit()
    await s.exit()

#loop = asyncio.get_event_loop()
#loop.run_until_complete( main() )
#loop.close()
try:
  asyncio.run( main() )#,debug=True )
except Exception as e:
    print(f"Caught an exception in my_coroutine: {e}")  
    traceback.print_exc()
finally:
  sys.exit()