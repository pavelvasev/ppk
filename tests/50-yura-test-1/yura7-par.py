#!/bin/env python3.9

# todo добавить интеграцию мю. для этого приоритеты задач надо создать.

# F-AVERAGE-IN-COMPUTE выгодно считать average вместе со счетом. Тогда проход по памяти - 1 штука.
# F-SYNC-1 sync проводится путем копирования по 1 значению а не целых блоков
# добавлено 1 значение слева. итого N+2 значений.
# параллельность
# визуализация во время счета
# ppk
# big N
# gui вернули
# jit https://numba.readthedocs.io/en/stable/user/jit.html
#     + https://stackoverflow.com/questions/74836674/numba-jit-failed-type-inference-due-to-non-precise-type-pyobject
# mu = mu_cur, mu_prev
# сделать чтобы график показывался во время щота
# Numericals for continuity equations
# 1D case

"""
todo: 
* гуи асинхронно отзывчиво
* сделать чтобы шаг выдавал свои крайние значения отдельно
  - будет меньше качать для синхронизации (а точнее не надо).
* для визуализации рисовать интеграл. 
* визуализация в отдельной очереди
* !!! похоже - надо таки ловить ошибки воркеров и сразу их печать. не дожидаясь когда они в промисах проявятся и тп..
  просто сидеть ловить ошибки. и даже соообщение под это придумать специальное.
"""

import numpy as np
import matplotlib.pyplot as plt
import matplotlib.animation as animation
#from numba import cuda
import numba

import asyncio
import ppk
import time

c = ppk.Client()
#s = ppk.RemoteSlurm()
s = ppk.LocalServer()

#import cupy as cp

x_0=0. #initial point
x_1=1. #final point
Time_interval=2.

P=10 # кол-во частей
K=100000
N=400*K # point per x
T=4000*K # points per time

Psize = N // P

GUI = None
REPORT = 10
#GUI = 10*K
#GUI = None
#None
#GUI = 100*K # update gui each GUI step
GUIT = 10

delta_t=Time_interval/(float(T))
h=(x_1-x_0)/(float(N))
relative_step=delta_t/h

mu1 = np.zeros(N+1)
#mu2 = np.zeros(N+1)
#mu_cur=np.zeros(N+1)
#mu_prev=np.zeros(N+1)
x_range=np.linspace(x_0,x_1,N+1)
#print(x_range)
#exit()
#expectation=0.

#first moment of mu[s_int]
"""
@numba.njit
def average(x_range, mu_cur):
    return np.sum( x_range*mu_cur )
"""    

#function f
#x_from_int=lambda j: (float(j)*h)+x_0
#f=lambda expect_y,j: expect_y-(x_from_int(j))

#Computation

# устройство блока
# 0 - место для граничного значения из левого блока. наверное сюда стоит перенести то что было 0 изначально
# 1 - первое свое значение. соответствует тому что было 0 изначально
# Psize - последнее свое значение
# Psize+1 - место для граничного значения из правого блока. соответствует позиции N изначальной
# сообразно цикл счета идет от 1 до Psize включительно.

# создать начальное mu 
# mu есть структура из блоков
async def make_initial_mu():    
    mu = []    
    #initialization
    # так то все части одинаковые
    mu_part = np.zeros(Psize+2) # +1 чтобы выполнить N+1
    mu_part.fill( (x_1-x_0)/(float(N)+1) )
    # поэтому кладем только 1 штучку а остальные части равны ей
    #check_part( mu_part,"initial")
    #p_mu = await c.add_data( mu_part )
    p_mu = await c.submit_payload( mu_part )
    for i in range(P):
        a = njit_comp_part_average( mu_part, i)
        q = await c.add_data( {"payload_info":[p_mu],"average":a} )
        mu.append( q )
        #mu.append( {"part":p_mu,"average":a} )
    return mu
    
#mu = cp.asarray( mu ) # on gpu
#x_range = cp.asarray( x_range )

#animation initialization
#plt.ion()

fig, ax = plt.subplots()
ax.set(xlim=(x_0, x_1), ylim=(0, 0.3))

line, = ax.plot(x_range, mu1, color='k', lw=2)    

#step of animation
def animate(mu):
    line.set_ydata(mu)
    plt.pause(0.0001)
#display

async def animate_p( p_mu,t_int ):
    mu = await get_all( p_mu, t_int )
    animate( mu )

if GUI is not None:
  plt.show(block=False)
  plt.pause(0.1)

#x_from_int=lambda j: (float(j)*h)+x_0
#f=lambda expect_y,j: expect_y-(x_from_int(j))

#step

"""
for t_int in range(1,T+1):
    mu_cur, mu_prev = mu_prev, mu_cur
    if GUIT is not None and t_int % GUIT == 0:
      print(t_int)
    step( mu_prev, mu_cur, relative_step, N, x_range )
    if GUI is not None and t_int % GUI == 0:
      #onhost = mu_cur.copy_to_host()
      onhost = mu_cur
      animate(onhost)
      plt.pause(0.0001)
"""

@numba.njit
def average_old1(x_range, mu_cur):
    return np.sum( x_range*mu_cur )

@numba.njit
def average_old2(mu_cur):
    average_y=0.
    for i in range(N+1):
        average_y+=mu_cur[i]*i/N
    return average_y

# mu_cur - структура из блоков
# результат - обещание вычисления среднего (по формуле Юры)

# вычисляет среднее одного кусочка
@numba.njit(fastmath=True)
def njit_comp_part_average(mu_part=None,part_index=None):
    average_y=0.
    i_start = part_index * Psize
    max = Psize+2 if part_index == P-1 else Psize+1
    # на последнем блоке надо идти до Psize+1 включительно
    for i in range(1,max):
        average_y+=mu_part[i]*(i_start+i-1)/N
    if average_y > 100000:
        print("average_y is big!!!! mu_part=",mu_part)
    return average_y

@numba.njit
def check_part( mu_part,info ):
    for i in range(len(mu_part)):
        if mu_part[i] > 10000:
            print("mu_part is strange!!!! info=",info,"mu_part=",mu_part)
            break

async def comp_part_average(mu_part=None,part_index=None,rapi=None):
    #mu_part = await rapi.get_payload( mu_part )
    return njit_comp_part_average( mu_part, part_index )     

"""
async def comp_part_average(mu_part=None,i_start=None,rapi=None):
    mu_part = await rapi.get_payload( mu_part )
    average_y=0.
    for i in range(len(mu_part)):
        average_y+=mu_part[i]*(i_start+i)/N
    return average_y
"""    

#async def comp_part_average(mu_part=None,i_start=None,rapi=None):
#return comp_part_average_njit( mu_part, i_start, rapi )

# складывает значения массива
# но не простого а нашего, с ключиком average
async def comp_sum_array( array=None,**kwargs ):
    sum = 0.
    for i in range(len(array)):
        sum += array[i]["average"]
    return sum

# запускает comp_part_average
async def part_average( mu_part,index ):    
    return await c.exec_request( c.python(comp_part_average,mu_part=mu_part,part_index=index), simple=True )

# запускает comp_sum_array    
async def sum_array( array_of_promises ):
    all = await c.when_all( array_of_promises )
    return await c.exec_request( c.python(comp_sum_array,array=all),simple=True )

async def average(mu_cur):

#    arr = []
#    for i in range(len(mu_cur)):
#        p_part_average = await part_average( mu_cur[i], i )
#        arr.append( p_part_average )
    p_sum = await sum_array( mu_cur )
    return p_sum

@numba.njit(fastmath=True)
def x_from_int(j):
    return (float(j)*h)+x_0

@numba.njit(fastmath=True)
def f(expect_y,j):
    return expect_y-(x_from_int(j))

# обмен крайними значениями
# выдает блок mu с закачанными значениями
def do_comp_sync_part( i, mu_part, mu_left, mu_right):
    # обмен границами
    mu_cur = np.copy( mu_part )

    if mu_left is not None and i > 0:
        #check_part( mu_left_part,"sync:left i="+str(i) )
        #print("going to access mu_left_part:",mu_left_part)
        #print("copy to cur 0",mu_left_part[ Psize ])
        mu_cur[0] = mu_left
    if mu_right is not None and i < P-1:
        #check_part( mu_right_part,"sync:right i="+str(i) )
        #print("copy to cur Psize",mu_right_part[ 1 ])
        mu_cur[Psize+1] = mu_right

    #print("thus part is synced. part_num=",i,"mu_cur=",mu_cur)    
    #check_part( mu_cur,"sync:result i="+str(i) )    

    return mu_cur
    
async def comp_sync_part( i=None, mu_part=None, mu_left_part=None, mu_right_part=None, rapi=None,**kwargs):

    #mu_part = await rapi.get_payload( mu_part["part"] )
    
    if mu_left_part is not None:
        mu_left_part = mu_left_part["right"]
    #    mu_left_part = await rapi.get_payload( mu_left_part )
    if mu_right_part is not None:
        mu_right_part = mu_right_part["left"]
    #    mu_right_part = await rapi.get_payload( mu_right_part )

    #print("comp_sync_part _called. i=",i,"mu_part=",mu_part,"mu_left_part=",mu_left_part,"mu_right_part=",mu_right_part)

    mu_cur = do_comp_sync_part( i, mu_part["payload"][0], mu_left_part, mu_right_part )

    #print("result synced mu_cur=",mu_cur)

    part_average = njit_comp_part_average( mu_cur, i )

    #d = await rapi.submit_payload( mu_cur )
    return {"payload":[mu_cur],"average":part_average}

async def sync_part( i, mu_part, mu_left_part, mu_right_part ):
    return await c.exec_request( c.python(comp_sync_part,i=i,mu_part=mu_part, mu_left_part=c.skip_payloads(mu_left_part),mu_right_part=c.skip_payloads(mu_right_part)) )

@numba.njit(fastmath=True)
async def njit_comp_step_part( mu_cur, mu_prev, part_num, expectation):
    #print("njit_comp_step_part _called. part_num=",part_num,"mu_prev=",mu_prev, "mu_prev[Psize]=",mu_prev[Psize])
    #mu_prev = mu_part
    #mu_cur = np.empty([Psize+1],dtype=np.float64)

    # крайние значения цельного mu
    if part_num == 0:        
        i0=0
        mu_cur[i0]=mu_prev[i0]+relative_step*(-abs(f(expectation,0))*mu_prev[i0]+max(-f(expectation,1),0)*mu_prev[i0+1]) # left border
        #print("patching P-first elem! P=",P,"part_num=",part_num,"value=",mu_cur[i0])

    if part_num == P-1:        
        mu_cur[Psize+1]=mu_prev[Psize+1]+relative_step*(-abs(f(expectation,N))*mu_prev[Psize+1]+max(f(expectation,N-1),0)*mu_prev[Psize-1+1]) # right border
        #mu_prev[Psize] = 0.0
        #mu_prev[Psize-1] = 0.0
        #mu_prev[Psize-2] = 0.0
        #print("patching P-last elem! P=",P,"part_num=",part_num, "value=",mu_cur[Psize+1])

    #start = 2 if part_num == 0 else 1
    start=1
    # цикл текущего блока
    i_start = part_num * Psize
    for i in range(start,Psize+1):
        i_glob = i + i_start
        mu_cur[i]=mu_prev[i]+relative_step*(max(f(expectation,i_glob-1),0)*mu_prev[i-1]-abs(f(expectation,i_glob))*mu_prev[i]+max(-f(expectation,i_glob+1),0)*mu_prev[i+1])

    #print("computed mu_cur. part_num=",part_num,"data=",mu_cur)
    #check_part( mu_cur,"step part_num="+str(part_num) )

    return mu_cur, mu_cur[1], mu_cur[Psize]

async def comp_step_part( mu_part=None, i=None, expectation=None,rapi=None,**kwargs):

    #mu_part = await rapi.get_payload( mu_part["part"] )

    #mu_cur = np.empty(Psize+1,np.float64)
    mu_cur = np.zeros([Psize+2])
    #mu_cur[Psize+1] = 0.0
    mu_cur, left, right = njit_comp_step_part( mu_cur, mu_part["payload"][0], i, expectation )
    
    #d = await rapi.submit_payload( mu_cur )
    return {"payload":[mu_cur],"left":left,"right":right}

# вычисляет 1 итерацию на блоке mu
# возвращает новое состояние этого блока
"""
async def comp_step_part( mu_part=None, mu_left_part=None, mu_right_part=None, i=None, expectation=None,rapi=None,**kwargs):

    mu_part = await rapi.get_payload( mu_part )
    mu_prev = mu_part
    if mu_left_part is not None:
        mu_left_part = await rapi.get_payload( mu_left_part )
    if mu_right_part is not None:        
        mu_right_part = await rapi.get_payload( mu_right_part )
    mu_cur = np.empty([Psize+1])

    # обмен границами
    if i > 0:
        mu_prev[0] = mu_left_part[ Psize ]
    if i < P-1:
        mu_prev[Psize] = mu_right_part[ 0 ]

    # крайние значения
    if i == 0:
        mu_cur[0]=mu_prev[0]+relative_step*(-abs(f(expectation,0))*mu_prev[0]+max(-f(expectation,1),0)*mu_prev[1]) # left border

    if i == P-1:
        mu_cur[Psize]=mu_prev[Psize]+relative_step*(-abs(f(expectation,N))*mu_prev[Psize]+max(f(expectation,N-1),0)*mu_prev[Psize-1]) # right border

    # цикл текущего блока
    for i in range(1,Psize):
        mu_cur[i]=mu_prev[i]+relative_step*(max(f(expectation,i-1),0)*mu_prev[i-1]-abs(f(expectation,i))*mu_prev[i]+max(-f(expectation,i+1),0)*mu_prev[i+1])

    d = await rapi.submit_payload( mu_cur )
    return d
"""    

# запускает comp_step_part
async def step_part( mu_part, i, expectation):
    return await c.exec_request( c.python(comp_step_part,mu_part=mu_part, i=i,expectation=expectation) )

# выполняет один шаг итерации
# выход - mu, структура из блоков
async def make_one_step(mu_prev=None,relative_step=None, N=None, t_int=None):
    p_expectation = await average( mu_prev )

    mu_unsynced = []
    # цикл по кусочкам
    for i in range(len(mu_prev)):
        next_part = await step_part( mu_prev[i], i,p_expectation )
        mu_unsynced.append( next_part )

    mu = []
    for i in range(len(mu_unsynced)):
        next_part = await sync_part( i, mu_unsynced[i],mu_unsynced[i-1] if i > 0 else None, mu_unsynced[i+1] if i < P-1 else None )
        mu.append( next_part )

    return mu

finish_counter=0
stats = {"counter":0}
interest = []

# todo вариант бы с прореживанием еще
async def get_all( mu, t_int ):
    total = np.empty(N+1)
    total[ N ] = 0.0
    i = 0
    #print("get_all begin t_int=",t_int)
    for part_num in range(len(mu)):
        part = mu[part_num]
        dp = await c.get_data( part )
        #print("get_all: loaded part",part,"t_int=",t_int,"part_num=",part_num,"dp=",dp)
        d = await c.get_payload( dp["payload_info"][0] ) 
        # вот в этот момент можно подумать о том что get_data должна восстанавливать объект.. а add_data кстати и сжимать. и все хорошо будет
        for j in range(1,Psize+1):
            total[ i+j ] = d[j]
        i += Psize
    #print("get_all finish t_int=",t_int)
    return total

start = time.time()
async def report_progress( mu, t_int, t_max ):
    all = await c.when_all( mu )
    result_p = await c.wait_promise( all )
    await result_p
    # вот теперь у нас есть все.
    t_used_sec = (time.time()-start)
    t_used = t_used_sec/60.0
    t_est_left = t_used * t_max / t_int
    t_left = t_est_left - t_used

    opers = N * (t_int) # -GUIT потому что до GUIT операций мы start не меряли
    opers_per_sec = opers / t_used_sec # операций в секунду над мю
    m_opers_per_sec = opers_per_sec / 1000000
    print(f"progress: {t_int} / {t_max} =  {100 * t_int / T :.2f}% time used (mins) = {t_used:.1f}, time left = {t_left:.1f}. | opers={opers} mln_opers_per_sec={m_opers_per_sec:.1f}")
    #print(f"progress: {t_int} / {t_max} =  {100 * t_int / T :.2f}% time used (mins) = {t_used:.1f}, time left = {t_left:.1f}, time total est={(t_used+t_left):.1f}. | opers={opers} / t_used_sec={t_used_sec} = mln_opers_per_sec={m_opers_per_sec:.1f}               ",end="\r")


async def main():
    print("starting system")
    s1 = await s.start()
    print("starting workers")
    w1 = await s.start_workers( 1, 5, 4000 )
    print("connecting")
    t1 = await c.connect( url=s.url )
    print("connected",t1)

    #p_x_range = await c.add_data( x_range )
    #p_mu = await c.add_data( mu1 )
    p_mu = await make_initial_mu()
    #print("initial p_mu=",p_mu)
    
    def on_task_finish(msg):
        stats["counter"] += 1
        print("done ",stats["counter"],end="\r")

    await c.query("runner-finished",on_task_finish)

    #step( mu_prev, mu_cur, relative_step, N, x_range )
    for t_int in range(1,T+1):
        #if GUIT is not None and t_int % GUIT == 0:
        #    print(t_int)
        print("submitting", t_int,end="\r")
        p_mu = await make_one_step( mu_prev=p_mu,relative_step=relative_step, N=N, t_int=t_int )
        #p_mu_next = await c.exec_request( c.python(step_ppk,mu_prev=p_mu,relative_step=relative_step, N=N, x_range=p_x_range,t_int=t_int) )
        #print("submitted, p_mu_next=",p_mu_next)
        #p_mu = p_mu_next
        await asyncio.sleep( 0.01 )
        if GUI is not None and t_int % GUI == 0:
            asyncio.create_task( animate_p( p_mu, t_int ) )

        if REPORT is not None and t_int % REPORT == 0:
            asyncio.create_task( report_progress( p_mu, t_int, T) )
            #interest.append( p_mu )

    print("ALL iters submitted",T,"          ")

    """
    while len(interest) > 0:
        vis = interest.pop(0)
        mu_vis_online = await get_all( vis )
        animate( mu_vis_online )
    """    

    #print("p_mu = ",p_mu, "waiting it's result")
    #mu = await c.get_data( p_mu[0] )
    mu = await get_all( p_mu,-1 )
    print("mu = ",mu)

    if GUI is not None:
        animate( mu )

    print("Exiting")
    await c.exit()
    await s.exit()
    

loop = asyncio.get_event_loop()
loop.run_until_complete( main() )
loop.run_until_complete( c.t1 )
loop.close()

#display result animation
#anim = animation.FuncAnimation(fig, animate, interval=T/1000, frames=T)
if GUI is not None:
    plt.show(block=True)
    
#print( mu_cur )    

exit()

#saving
print("saving")
writervideo = animation.FFMpegWriter(fps=60)
anim.save('cont_1d.avi', writer=writervideo)
print("saved")