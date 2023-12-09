#!/bin/env python3.9
# PYTHONUNBUFFERED=TRUE

# todo resources info, cleanup...

import asyncio
from ppk import Client
import numpy as np
import sys
#import marshal
import traceback
import inspect
#import cloudpickle
import pickle
#import time
import gc

import time

#from numba import njit, set_num_threads
#set_num_threads(2)

# https://stackoverflow.com/a/37429875
from contextlib import contextmanager
import logging
@contextmanager
def log_time(prefix=""):
    '''log the time usage in a code block
    prefix: the prefix text to show
    '''
    start = time.perf_counter_ns()
    log(prefix,"started")
    try:
        yield
    finally:
        end = time.perf_counter_ns()
        log(prefix, (end - start)/1000000.0,"ms")
        #log(prefix, (end - start)/1000.0,"microseconds")
        #elapsed_seconds = float("%.6f" % (end - start))
        #print(prefix, elapsed_seconds,"sec",flush=True)

start_time = time.perf_counter_ns()
def log(*args):
  cur_tm_millisecs = (time.perf_counter_ns() - start_time)/1000000.0
  print(cur_tm_millisecs,":", *args )#, flush=True)

class PythonEnv:
  
  # urla - адрес main
  # interrunner
  def __init__(self,urla, interrunner):
    self.urla = urla
    self.interrunner = interrunner
    self.rapi = Client( sender="python-env" )

    #c.verbose = True
    needs_env = {}
    needs_env["compile-python"] = asyncio.Future()
    needs_env["compile-python"].set_result( self.compile_python )
    needs_env["compute"] = asyncio.Future()
    needs_env["compute"].set_result( self.compute )
    needs_env["get-payload"] = asyncio.Future()
    needs_env["get-payload"].set_result( self.get_payload )
    needs_env["restore-object"] = asyncio.Future()
    needs_env["restore-object"].set_result( self.restore_object )
    needs_env["skip-payloads"] = asyncio.Future()
    needs_env["skip-payloads"].set_result( self.skip_payloads )    
    needs_env["reuse-payloads"] = asyncio.Future()
    needs_env["reuse-payloads"].set_result( self.reuse_payloads )        

    self.needs_env = needs_env

    #self.rapi.get_payload_element = self.get_promise
    

  # идея 2023-07-08  F-REUSE-PAYLOADS
  # alloc - это значит что можно аллоцировать заново, не обязательно наполнять имеющимися данными
  # если alloc не выставлен, будет проводиться копирование железное
  # получается что alloc=False равен restore-object, если промиса не развернута, и равен переводу ниды в ответственность reuse-а, если она развернута
  # кстати я не помню, мы reuse-payloads то вообще за ниду считаем?
  # ну и по идее, после выполнения задачи.. reuse надо стереть. чтобы он нигде не фигурировал
  # и ссылки на буфера памяти дополнительные не держал
  async def reuse_payloads( self,p, id, alloc=False ):
    print("reuse-payload: called, id=",id,"p=",p,"alloc=",alloc,"has-promise=",self.has_promise(id),flush=True)
    # ничего там нет
    # но вообще такого не должно быть так-то
    #if "payload_info" not in p: 
    #  return None

    # есть буфер
    # alloc - специальный флаг что надо забить и аллоцировать таки
    # ну времянка
    # кстати вопрос а это нормально что там может не быть пейлоада вообще загружено?
    # ну а почему нет.. просто прислали нам промису, а она и не развернута - ну нормально же
    # у нас вот ключ alloc может быть -..
    if self.has_promise( id ):
      # надо ее забыть
      print("reuse-payload: ok-has-promise id=",id,"clearing and sending auto_clear_need")
      p = self.get_promise(id).result() # или надо подождать?
      await self.clear_promise(id)
      # и сообщить о забытом в раннер      
      await self.rapi.msg( {"label":self.interrunner,"stage":"auto_clear_need","id":id} )
      # я решил тут добавить инфо про ресурсы. потому что.. это позволит более взвешенно принимать
      # решение раннеру. он там посчитает что цена 0. мы тут удалим старую ниду, очистим из памяти
      # и добавим старую цену. все хорошо. 
      # кстати не надо добавлять инфо про цену - она и так в старой ниде есть
      print("reuse-payload: Returning: ",p)
      p["resources"] = {"ram":1024} # типа это ж времянка.. ток для передачи на вход..
      del p["payload_info"]
      # ну типа ее даже и запоминать не надо.. todo кстати.      
      return p

    if not alloc: # may_alloc это имеется ввиду
       
       print("reuse-payload: allocating-memory! restore-object branch ",id)
       # ну стало быть надо закопировать
       # так а может заодно и промису равернуть оригинала? мол restore-object выполнен, вдруг пригодится
       bufs = await self.rapi.get_payloads( p["payload_info"] )
       p["payload"] = bufs
       p["resources"] = {"ram":1024} # типа это ж времянка.. ток для передачи на вход..
       del p["payload_info"]
       print("reuse-payload: returning:",p)   
       return p

    
    print("reuse-payload: allocating-memory! alloc-branch",id)
    # идея - msg в пользовательский канал. и там разные логи. и тогда их видно в интерфейсе
    # мб даже в графическом

    # она не развернута такая промиса. надо создать буфер
    bufs = []
    for k in p["payload_info"]:
      cnt = k["bytes_count"] // 8
      print("reuse allocates cnt=",cnt)
      # пока так. надо учесть shape и dtype
      buf = np.zeros([cnt])
      bufs.append( buf )

    # если там single_payload это надо учесть
    # а главное вопрос. как мы это возвращать будем.
    
    p = dict(p) # скопируем и заменим/выставим payloads
    p["payload"] = bufs
    del p["payload_info"] # таки нам надо новое сгенерировать будет исходя из нашей модели текущей что пейлоады доступ не по id своему имеют
    p["resources"] = {"ram":1024} # типа это ж времянка.. ток для передачи в
    print("reuse-payload: returning:",p)
    #{ "payload": bufs }
    return p


  def skip_payloads( self,p ):
    #return p
    q = dict(p)
    #q["resources"] = {"ram":1024}
    return q

  def compile_python(self,hex,info):
    b= bytearray.fromhex( hex )
    #func.__code__ = marshal.loads( b )
    func = pickle.loads( b )
    return func

  async def compute(self,func,**kwargs):
    res = func( **kwargs )
    if inspect.isawaitable(res):
      res = await res
    return res

  async def get_payload(self,payload_info):
    #print("PPK-env get_payload",payload_info,flush=True)
    res = await self.rapi.get_payloads( payload_info )
    return res

  async def restore_object(self,payload_info,**kwargs):
    #print("PPK-env restore-object",payload_info,kwargs,flush=True)
    with log_time("restore-object get-payloads"+str(payload_info)):
      res = await self.rapi.get_payloads( payload_info )
    if "single_payload" in kwargs:
       return res[0]
    kwargs["payload"] = res
    kwargs["payload_info"] = payload_info
    return kwargs

  async def clear_need(self,id,**kwargs):
    await self.clear_promise(id)
    return True

  async def add_task(self, id, action_id, const_args, needs_args, is_main_queue, **kwargs):
    self_p = self.get_or_create_promise( id ) # F-TASKS-ZAPUTANNOST

    func_p = self.get_promise( action_id )
    #func = await self.needs_env[ action_id ]
    await func_p
    func = func_p.result()

    #if inspect.isawaitable(func): 
    # func = await func
    needs_args_names = needs_args.keys()
    # тут было get_promise но оказывается бывает что мы ее назначим создавать,
    # а это де-факто позже начинает исполняться задача.. а использующая задача из другого потока
    # раньше проскакивает.. можно разобрать этот случай как-то.. ну либо всегда их посылать как add-task
    # а затем если уже создано - то не делать. но это много лишней работы.. F-TASKS-ZAPUTANNOST
    needs_futures = { k: self.get_or_create_promise(v) for k,v in needs_args.items() }
    if len(needs_futures.values()) > 0:
      with log_time("waiting needs-promises: "+id + " -> " + ";".join(list(needs_args.values())) ):
        await asyncio.wait( needs_futures.values() )
      # дождались результатов. совмещаем их с const_args/ можно прямо там
      for k,v in needs_futures.items():
        const_args[k] = v.result()

      #if action_id == "reuse-payloads": # хак, особая форма
      #  const_args["id"] = needs_args["p"]
    #print("python-env:calling action_id=",action_id,"args are",const_args,flush=True)        
    with log_time("main-func: ismain="+str(is_main_queue) + " " + id):
      result = func( **const_args ) # хм.. xxx
    if inspect.isawaitable(result):
      result = await result
    #print("python-env:calling func result=",result,flush=True)        

    # запомнили результат в форме ниды
    self_p.set_result( result )
    if not is_main_queue:
      # это поток подготовки нид - больше ничего делать не надо, выгружать наружу тоже не придется
      # todo resources
      return {"need_assigned":True, "resources":self.compute_resources(result)}

    with log_time("unfat-result: "+id):
      # надо обезжирить результат
      result = self.unfat_result( result,id )

    # надо разрезолвить результат в таблице вычислений
    #with log_time("resolve-global-promise: "+id):
    #  own_globl_promise = self.rapi.create_promise( id )
    #  await self.rapi.resolve_promise( own_globl_promise, result )

    # добавим информацию о используемой памяти
    # может быть - до резолвинга промисы? или они там сами с усами?
    self.add_resouces_info( result )

    return result

  def add_resouces_info( self,data ):
    if isinstance(data,dict) and "payload_info" in data:
      sum = 0
      for p in data["payload_info"]:
        sum += p["bytes_count"]
      data["resources"] = {"ram": sum }

  # понятно... ну тут надо считать необезжиренный объект.. todo    
  def compute_resources( self, data):
    """
    if isinstance(data,dict) and "payload_info" in data:
      sum = 0
      for p in data["payload_info"]:
        sum += p["bytes_count"]
      return {"ram": sum }
    """  
    if isinstance(data,dict) and "resources" in data:
      return data["resources"]
    if isinstance(data,dict) and "tobytes" in data:
      return {"ram": data.nbytes }
    if isinstance(data,dict) and "payload" in data:  
      sum = 0
      for p in data["payload"]:
        sum += p.nbytes
      return {"ram": sum }
    return {"ram":2048}

  def unfat_result( self,data,id ):
    #d = dir(data)
    #print("unfat_result called. data=",data)
    if "tobytes" in dir(data):
      res = self.rapi.submit_payloads_inmem( [data], id )
      #res = await self.rapi.submit_payloads( data )
      # add_data_flag?
      # ну или таки - превратить в структуру с payload_info чтоб не мучиться многообразию?
      res = { "single_payload": True, "payload_info":res}
      return res
    elif isinstance(data,dict) and "payload" in data:
      if "payload_info" in data: # типа уже есть - не дублируем
        data2 = dict(data)
        del data2["payload"]
        return data2
      else:
        #res = await self.rapi.submit_payloads( data["payload"] ) # пока считаем что их много?
        res = self.rapi.submit_payloads_inmem( data["payload"],id ) # пока считаем что их много?
        data2 = dict( data ) # типа мы ее считаем словарем. ну и продублируем и добавим поле
        del data2["payload"]
        data2["payload_info"] = res        
        data["payload_info"] = res # надо сохранить и в ниду.. для идеи повторного использования памяти
        return data2
    #elif callable(data):
    #  return {"is_a_function":true}  

    return data

  def create_promise( self,id ):
    if id in self.needs_env:
      raise Exception( "create_promise: id already exist",id)
    f = asyncio.Future()
    self.needs_env[id] = f
    return f

  def has_promise( self,id ):
    return (id in self.needs_env)

  def get_promise( self,id ):
    if id not in self.needs_env:
      raise Exception( "get_promise: id not exist",id)

    return self.needs_env[id]

  def get_or_create_promise( self,id ):
    if id not in self.needs_env:
      return self.create_promise( id )

    return self.needs_env[id]    

  async def clear_promise( self,id ):
    if not self.has_promise(id):
      return True # ну нет уже, почистили
    pp = self.get_promise(id)
    # а зачем нам их получать?
    #p = await pp # получили данные
    await self.rapi.forget_payloads_inmem(id)
    #print("python-env:clearing promise",id,flush=True)
    del self.needs_env[id]
    # gc.collect()

  async def main(self):
    t1 = await self.rapi.connect( url=self.urla )
    log("python-env:connected",t1)
    await self.rapi.start_payloads_inmem_server()
    log("python-env: inmem payloads server started")
    
    self.my_task_queue = "python-env-tq-" + self.rapi.mkguid()
    
    # но кстати формально сигналом о готовности может быть размещение запроса
    # и мы вполне его могли бы и ловить
    await self.rapi.query( self.my_task_queue, self.on_compute_request )
    # сообщаем сигнал о готовности к работе и заодно уж свою очередь задач
    #await self.rapi.request( {"label":self.interrunner,"stage":"set_task_queue","python_task_id":self.my_task_queue}, lambda x: True )
    await self.rapi.msg( {"label":self.interrunner,"stage":"set_task_queue","python_task_id":self.my_task_queue} )

  # ну попробуем так. не факт конечно.
  async def on_compute_request(self,msg):
    log("python-env: on_compute_request, msg=",msg)
    asyncio.create_task( self.on_compute_request_do( msg ) )  

  async def on_compute_request_do(self,msg):
    #print("python-env: on_compute_request_do ",flush=True)
    #print("gonna call func=",func,flush=True)
    cmd = msg["cmd"]
    try:
        if cmd == "add_task":
          #print("python-env: add_task, !!!!! is_main_queue=",msg["is_main_queue"],flush=True)
          result = await self.add_task( **msg )
          #print("computed result. result is",result,flush=True)
          
        if cmd == "clear_need":
          result = await self.clear_need( **msg )
        #args = msg["args"]
        
        #func = func_info["func"]
        #result = await func( **args, rapi=c)

        packet = { "success":True, "value":result }
    except Exception as ex:
        tr = traceback.format_exc()
        packet = { "success":False, "msg":str(ex) + "//" + tr }
        # ну подумать. так то в сообщении тож хорошо
        #packet = { "success":False, "msg":"ppk-python-env error. see log." }
        # благодаря этому попадет в лог а еще потом прилетит в консоль пользователя
        #print(str(ex),tr, flush=True)
        print(str(ex),tr,file=sys.stderr, flush=True)
    #log("computed result. sending repl packet to id=",msg["id"],"packet=",packet)
    # надо предпринять меры, если вернули двоичные данные
    with log_time("send reply packet: "+msg["id"]):
      await self.rapi.reply( msg, packet )
    #print("Ns:",time.perf_counter_ns(),"result. sending repl packet to id=",msg["id"],packet,flush=True)
    #print("it is sent",flush=True)    

##################################

urla = sys.argv[1]
interrunner = sys.argv[2]
log("ppk-python-env: started with url2=",urla," and interrunner channel=",interrunner)

pe = PythonEnv(urla,interrunner)
loop = asyncio.get_event_loop()
loop.run_until_complete( pe.main() )
loop.run_until_complete( pe.rapi.t1 )
loop.close()

#asyncio.run( main() )