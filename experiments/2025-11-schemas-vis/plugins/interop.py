"""
todo перенести сюда define из genesis
"""

import ppk.genesis as gen
import importlib
import os
import sys
import glob
import yaml

"""
абстракция на уровне yaml

items:
  - type: define
    name: axis
    items:
      - type: lines
        params:
          positions: [0,0,0, 10,0,0, 0,0,0, 0,10,0, 0,0,0, 0,0,10 ]

после этого доступен тип axis

"""
def do_define(rapi,type_description,type_parent):
  print("do-define:",type_description)
  def do_create_defined_object(rapi,description,parent ):
    description = description.copy()
    description["type"] = "node"
    obj = gen.create_object(rapi, description, parent)
    # этот порядок задает что то что описано в типе будет применяться 
    # после того что в определении объекта. наверное это не фонтан.
    gen.apply_description( rapi, obj, type_description )
    return obj
  gen.register({type_description["name"]:do_create_defined_object})
  return None

"""
Загрузка внешних yaml

items:
  - type: load
    path: */*.yaml

ideas:
* 1 файл
* набор файлов
* маска
* веб-ресурс..?
* константа? (типа имя в таблице файлов, не в фс)    

вопросы:
* если сцена загружается в сцену, что это значит? по идее это просто мерж
* надо 1 axis, одну камеру.. по идее это можно по признаку является ли наша сцена корневой

проблемы
* глобальные каналы в под-сценах вообще-то должны быть локальными.
в рамках сцены. стало быть ppk должен создавать под-мир со своими id
и получается со своими id глобальных каналов...
* надо заводить контекст для подпроектов. какой их каталог, например.
они же там локальные имена используют.

"""
def do_load(rapi,description,parent):

  p = description["path"]

  files = glob.glob( p )

  for project_file in files:
    print("load: parsing file",project_file)
    with open(project_file) as stream:
        try:
            info = yaml.safe_load(stream)
        except yaml.YAMLError as exc:
            print("============== YAML ERROR ==============")
            print(exc)
            print("==============")
            sys.exit(-1)

    print("info=",info)
    # загружаем. ставим parent-ом parent-а load    
    gen.create_object( rapi, info, parent )        

  # таким образом можно считать что load выполнился, 
  # расположил вместо себя 1 или более объектов
  # и растворился
  return None

"""
Импорт плагина visix

items:
  - type: plugin
    name: myplugin

myplugin - ссылка на пакет Питона. 
Например это может быть имя локального файла (если плагин в файле)
или каталога (если плагин в каталоге)

todo сейчас плагины загружаются из текущей директории.
но надо загружать из директории текущего yaml
"""
def do_import(rapi,description,parent):

  name = description["name"]

  #mdir = os.path.dirname(description["dir"])
  mdir = os.getcwd()
  sys.path.insert(0,mdir)

  #pname = "visix.test"
  pname = None
  module = importlib.import_module(name, package=pname)

  sys.path.remove(mdir)

  module.init(rapi)

  return None

def init(*args):
  gen.register({"plugin":do_import})  
  gen.register({"load":do_load})
  gen.register({"define":do_define})