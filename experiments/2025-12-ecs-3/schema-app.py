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

##############################
class BindEntityFeature:
    #### request
    def __init__(self,rapi):
        self.rapi = rapi        
        rapi.bind_entity = self.bind_entity

    def bind_entity( self, src, tgt, workers ):
        print("ENTITY COMPONENT BIND",src,"----->",tgt)

        nodes = gen.node( "link",
            src_entity_id = src[0],
            src_component_name = src[1],
            target_entity_id = tgt[0],
            target_component_name = tgt[1],
            tags=["ecs_system"])
        for w in workers:
            w.put( {"description":nodes,"action":"create"})

        """
        msg = dict( label = src[0] + "/manage", 
                        component_name = src[1],
                        target_entity_id = tgt[0],
                        target_component_name = tgt[1]
                        )
        self.rapi.put_msg( msg )
        """
        #  [f"vv_{i:04d}","image"],[f"image_merge_level0_{i}", "image"] 

ppk.DEFAULT_EXTENSIONS["bind_entity"] = BindEntityFeature
##############################

def on_worker_msg(msg):
    print("msg from worker: ",msg)

async def start_worker_process(url, worker_id, input_channel_id, output_channel_id,logdir):
    env = os.environ.copy() | {"PPK_INPUT_CHANNEL":input_channel_id,"PPK_REPORT_CHANNEL":output_channel_id,"PPK_URL":url}
    log = os.open(f"{logdir}/{worker_id}.log",os.O_WRONLY | os.O_CREAT | os.O_TRUNC,0o644)
    logerr = os.open(f"{logdir}/{worker_id}.err.log",os.O_WRONLY | os.O_CREAT | os.O_TRUNC,0o644)

    # subprocess.popen уместнее было бы
    p = await asyncio.create_subprocess_exec(sys.executable,"./genesis_worker.py",env=env,stdin=subprocess.DEVNULL,stderr=logerr,stdout=log)
    def cleanup():        
        if p.returncode is None:
            p.terminate()
    atexit.register(cleanup)
    return p

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
        vv_entities_list_3d = vv.deploy( worker_channels )
        
        init = plugins.life.RandomVoxels()
        init.deploy( worker_channels )

        game = plugins.life.GameOfLife3D()
        game.deploy( worker_channels )

        gamesync = plugins.life.VoxelVolumeSync( rapi, shape, vv_entities_list_3d )
        gamesync.deploy( worker_channels )

        paint = voxpaint.VoxelVolumePaint( size=10,shape=shape )
        paint.deploy( worker_channels )

        # порядок важен. это фишка метода
        total = shape[0]*shape[1]*shape[2]
        merger = plugins.common.ImageMerger(rapi,total)
        merger.deploy( worker_channels )

        pass2merger = plugins.common.PassImagesToMerger(rapi,total)
        pass2merger.deploy( worker_channels )

        # idea worker в аргументы классу? но зачем нам сразу раскидывать...
        saver = plugins.common.ImageSaver()
        saver.deploy( worker_channels )

        # todo вопросики, наверное надо после сохранения
        rapi.bind( merger.final_ch, gamesync.continue_ch )

        sim = plugins.ecs.Simulation()
        sim.deploy( worker_channels )

        """
        init = plugins.life.RandomVoxels( shape=shape )
        gamestep = plugins.life.GameOfLife3D( shape=shape )
        pass_data = plugins.common.TriggerPass3D( shape=shape,n=1000*1000 )
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

        """
          start -> ПАМЯТЬ -> D0 -> init -> D1 -> gamestep -> D2
                       D2 -> paint
                       D2 -> pass_data -> D1
        """

        """

        hyper_link_out( vv,"output","D0")
        hyper_link_in( init,"input","D0")
        hyper_link_out( init,"output","D1")
        hyper_link_in( gamestep,"input","D1")
        single_hyper_link_in( vv, "input","start")

        hyper_link_out( gamestep,"output","D2")

        hyper_link_in( pass_data,"input","D2")
        single_hyper_link_in( pass_data, "trigger","render_ready")
        hyper_link_out( pass_data,"output","D1")

        hyper_link_in( paint,"input","D2")
        hyper_link_out( paint,"output","D3")
        hyper_link_in( merge,"input","D3")
        """

        start = rapi.channel("start")
        print("starting")
        start.put(1)

    except Exception as e:
        print(f"Caught an exception in my_coroutine: {e}")  
        traceback.print_exc()        

    ####################################

    print("done, waiting forever 20")
    #await asyncio.Future()
    await asyncio.sleep( 20 )
    #print("stopping")

    print("calling workers exit")
    for w in worker_channels:
        w.put( {"action":"exit"})
    await asyncio.sleep( 0.1 )
 
    print("calling exit")
    #exit(0)
    #sys.exit()
    print("Exiting client")    
    await rapi.exit() #todo зависает
    print("Exiting server")
    await s.exit()
    print("Exiting main")

#loop = asyncio.get_event_loop()
#loop.run_until_complete( main() )
#loop.close()
try:
    asyncio.run( main() )#,debug=True )
except Exception as e:
    print(f"Caught an exception in my_coroutine: {e}")  
    traceback.print_exc()
finally:
    print("sys.exit")
    sys.exit()