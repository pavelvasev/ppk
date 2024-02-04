#!/bin/env python3

# Проводит набор расчетов с разными параметрами. 
# Печатает результат в формате CSV.

commands=[ ["seq","./0-sequential.js"],
           ["task-graph","./1-task-graph.js"],
           ["manual","./2-manual.js"],
           ["iter-graph","./3-iter-graph.js"]
         ]
p_list = [2,4,8,16]
dn_list = [1000, 100*1000, 1000*1000, 10*1000*1000]
count = 4 # сколько раз провести тест

import subprocess
import re
import subprocess, os

def run(cmd,env):
  #print("run cmd=",cmd)
  result = subprocess.run([cmd], shell=True, capture_output=True, env=env)
  #print("result=",result)
  #print('output: ', result.stdout)
  r = re.search( r"compute: ([^\\]+)", str(result.stdout) )#, flags=re.MULTILINE )
  #print("r=",r)
  time_str = r.group(1)
  #print("time_str=",time_str)
  if "(m:ss.mmm)" in time_str:
    arr = time_str.split(":")
    time_sec = float(arr[0])*60 + float(arr[1].split(" ")[0])
  elif "ms" in time_str:
    time_sec = float(time_str.split("ms")[0])/1000
  else:
    time_sec = float( time_str.split("s")[0] )
  return time_sec

def run_serie( commands, dn, p ):
  my_env = os.environ.copy()
  my_env["DN"] = str(dn)
  my_env["P"] = str(p)
  for c in commands:
    #print("c=",c)
    seconds = run( c[1],my_env )
    print(c[0],",",dn,",",p,",",seconds)

#run_serie( 100*1000,4 )

print("CMD,DN,P,SECONDS")

for dn in dn_list:  
  #print( "|",[(" P="+str(p)).ljust(pad," ") for p in p_list].join("|"), "|" )
  #for p in p_list:
  for c in range(0,count):
    for p in p_list:
      run_serie( commands, dn,p )
