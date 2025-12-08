import os
import sys

import ppk
import ppk.genesis as gen

import numpy as np
import asyncio
import traceback

"""
class Entity:
    def __init__(self, entity_id):
        self.id = entity_id
"""        

def print_world( w ):
    print("################################### world dump begin")
    print("################ entities view")    
    #for entity_id, e in w.entities.items():
    #    print( " * ",entity_id, ":", " ".join(sorted(e.components.keys())) )
    for entity_id, e in w.entities.items():
        #print( " * ",entity_id, ":", " ".join(sorted(e.components.keys())) )
        print( " *",entity_id)
        for component_name in sorted(e.components.keys()):
            component_name_s = component_name

            # есть исходящие обновления, ждет разрешения от получателя
            if component_name in e.pending_outputs:
                cnt = len(e.pending_outputs[component_name].keys())
                if cnt > 0:
                    component_name_s = component_name_s + " >>>"
                    # добавим получателей
                    #print("blocked outputs:")
                    for k in e.pending_outputs[component_name].keys():
                        component_name_s = component_name_s + " remote: " + k

            # есть входящие сообщения (запросы), ждет процессов чтобы пропустить их
            if component_name in e.pending_updates:
                cnt = len(e.pending_updates[component_name])
                if cnt > 0:
                    component_name_s = " >>> " + component_name_s
                    # добавим процессы блокирующие xxx
                    for k in e.pending_processes[component_name]:
                        component_name_s = component_name_s + " proc: " + k

            outgoing_links = e.get_outgoing_links()
            if component_name in outgoing_links:
                for rec in outgoing_links[component_name]:
                    component_name_s = component_name_s + " @" + rec.target_key

            print( "   -",component_name_s)
        #, ":", " ".join(sorted(e.components.keys())) )

    print("################ components view")
    for component_name, e in w.components.items():
        print( " -",component_name)
        print( "   entities :"," ".join(sorted(w.components[component_name].keys()) ))          
        if component_name in w.component_processes:
            print( "   processes :"," ".join(sorted(w.component_processes.get(component_name,{}).keys()) ))
    print("################################### world done",flush=True)

def print_world1( w ):
    print("################################### world begin")
    print("################ entities view")    
    for entity_id, e in w.entities.items():
        print( " * ",entity_id )
        for component_name,cv in e.components.items():
            print("     - ",component_name)
    print("################ components view")
    for component_name, e in w.components.items():
        print( " - ",component_name, ":"," ".join(w.components[component_name].keys() ))        
    print("################################### world dump done")        

class World:
    def __init__(self):
        self.entities = {}
        self.components = {} # Stores components by type, then by entity ID

        # таблица entity_id -> {component} -> [outgoing-links-objects]
        self.links = {}

        # таблица имя-компоненты -> список обрабатывающих процессов (в форме словаря)
        self.component_processes = {}

    """
    def create_entity(self,entity_id):
        #entity_id = len(self.entities) # Simple ID generation
        entity = Entity(entity_id)
        self.entities[entity_id] = entity
        return entity_id
    """    

    def add_link( self, link ):
        if link.src_entity_id not in self.links:
            self.links[ link.src_entity_id ] = {}
        if link.src_component_name not in self.links[ link.src_entity_id ]:
            self.links[ link.src_entity_id ][link.src_component_name] = []

        self.links[ link.src_entity_id ][link.src_component_name].append(link)

        print("local world appended link:",link.src_key, "to key",link.target_key)

    def add_entity( self, entity_id, entity ):
        self.entities[ entity_id ] = entity

    def add_component(self, entity_id, component_type, component):
        #component_type = type(component)
        if component_type not in self.components:
            self.components[component_type] = {}
        self.components[component_type][entity_id] = component

    def remove_component(self, entity_id, component_type):
        del self.components[component_type][entity_id]

    def get_component(self, entity_id, component_type):
        return self.components.get(component_type, {}).get(entity_id)

    def get_entity(self, id):
        return self.entities[id]

    def get_entities_with_components(self, *component_types, marker,verbose=False):
        if verbose:
            print("get_entities_with_components: component_types=",component_types,"marker=",marker)
        # Returns entity IDs that have all specified component types
        if not component_types:
            return self.entities.keys()

        #F-COMP-SYNC
        if marker is not None:
            for comp_type in component_types:
                if comp_type not in self.component_processes:
                    self.component_processes[ comp_type ] = {}
                self.component_processes[ comp_type ][marker] = 1

        first_component_entities = set(self.components.get(component_types[0], {}).keys())
        
        if not first_component_entities:
            return set()

        for comp_type in component_types[1:]:
            current_component_entities = set(self.components.get(comp_type, {}).keys())
            first_component_entities.intersection_update(current_component_entities)
            if not first_component_entities:
                break # Optimization: if intersection becomes empty, no need to continue

        # заблокируем обработку сущностей которые ждут исходящей выгрузки компонент                
        for entity_id in first_component_entities:
            e = self.get_entity( entity_id )
            for component_name in e.pending_outputs:
                recs =  e.pending_outputs[component_name]
                total = len(recs.keys())
                if total > 0:
                    #if verbose:
                    print("entity",entity_id,"is blocked, it has pending_output on component_name=",component_name)
                    return set()

        if marker is not None:
            # фильтр по маркеру
            # правило: никакая из запрошенных компонент не должна содержать данный маркер
            # если сущность выдерживает этот критерий, то она проходит фильтр
            # а во все запрошенные компоненты маркер устанавливается
            cc = set()
            for entity_id in first_component_entities:
                e = self.get_entity( entity_id )

                marker_found = False
                for component_name in component_types:
                    component = e.get_component(component_name)
                    if marker in component:                        
                        marker_found = True
                        if verbose:
                            print("entity",entity_id,"skipped because marker found in component",component_name)
                        break

                if not marker_found:
                    cc.add( entity_id )
                    for component_name in component_types:
                        e.component_processed( component_name, marker )

            return cc

        return first_component_entities
  

class LoopComponent:
    """
    Компонента, которая запускает вечный цикл в отдельной задаче.
    """
    
    def __init__(self,local_systems,local_world):
        self._running = False
        self.local_systems = local_systems
        self.local_world = local_world
        # Создаем и запускаем задачу
        self._task = asyncio.create_task(self._run_loop())
    
    async def _run_loop(self):
        """Вечный цикл работы компоненты."""
        self._running = True
        iteration = 0
        
        try:
            while self._running:
                # Здесь ваша логика работы
                iteration += 1
                print(f"LoopComponent: Итерация {iteration} len(LOCAL_SYSTEMS)=",len(self.local_systems),flush=True)
                for s in self.local_systems:
                    s.process_ecs( iteration, self.local_world )
                print(f"LoopComponent: Итерация {iteration} успешно завершена",flush=True)

                print_world( self.local_world )

                # Передаем управление event loop'у
                #await asyncio.sleep(1)
                await asyncio.sleep(0.1)
                #await asyncio.sleep(0.0000001)

        except asyncio.CancelledError:
            print("LoopComponent: Задача была отменена")
            raise
        except Exception as e:
            print("LoopComponent: Произошла ошибка",e)
            #traceback.print_exc()
            #traceback.print_stack()
            traceback.print_exc()


        finally:
            print("LoopComponent: Цикл завершен, выхожу.")
    
    async def stop(self):
        """Остановка компоненты."""
        print("Loop: stop called")
        if self._task and not self._task.done():
            self._running = False
            print("calling task.cancel")
            self._task.cancel()
            try:
                await self._task
            except asyncio.CancelledError:
                pass
    
    def is_running(self) -> bool:
        """Проверка, работает ли компонента."""
        return self._running and self._task and not self._task.done()


class link:
    def __init__(self,rapi,description,parent):
        self.rapi = rapi

        self.src_entity_id = None
        self.src_component_name = None
        self.target_entity_id = None
        self.target_component_name = None
        gen.apply_description( rapi, self, description )
        # после этого аттрибуты выше - заполнены

        self.local_world = description["local_world"]
        self.src_key = self.src_entity_id + "/" + self.src_component_name
        self.target_key = self.target_entity_id + "/" + self.target_component_name
        self.target_put_request_label = self.target_entity_id + "/put_request"
        self.target_put_label = self.target_entity_id + "/put"

        self.local_world.add_link( self )

# немного странно что мы данные храним и в мире и в entity но пока сойдет
class entity:
    def __init__(self,rapi,description,parent):
        self.rapi = rapi
        self.id = description["params"]["entity_id"]
        self.entity_id = self.id # ну тоже закопируют
        #gen.id_generator()        
        #self.update_component_channel = rapi.channel(self.id)
        self.components = dict()
        self.maybe_components = []

        self.setup_sync()

        # исходящие сигналы при обновлении компонент
        self.component_channels_out = dict()
        self.component_channels_in = dict()
        #можем также удалять компоненты по сообщению но вроде пока не надо
        #self.component_channels_rm = dict()

        self.local_world = description["local_world"]

        self.local_world.add_entity( self.id, self )

        #self.output = ppk.local.Channel()
        #self.result = ppk.local.Channel() # итого
        #self.input = ppk.local.Channel()
        #self.n = ppk.local.Cell()
        #self.cnt = 0

        #self.update_component_channel.react( on_update_component )

        gen.apply_description( rapi, self, description )

        # внедряем присланные компоненты
        if "components" in description["params"]:
            for cname,cvalue in description["params"]["components"].items():
                self.update_component(cname,cvalue)

        # создание ссылок        
        if "maybe_components" in description["params"]:
            for cname in description["params"]["maybe_components"]:
                self.create_component_links( cname )

        print("ecs-entity item created")

    def component_processed(self,component_name, process_id ):
        print("entity component processed", self.entity_id,"component_name=",component_name,"with marker",process_id)
        #if not self.has_component( component_name )
        component = self.get_component(component_name)
        component[process_id] = 1

        self.active_processes[process_id] = 1 #F-ACTIVE-PROC

        if component_name in self.pending_processes:
            print("see component in pending_processes")
            if process_id in self.pending_processes[component_name]:
                del self.pending_processes[component_name][process_id]

            if len(self.pending_processes[component_name].keys()) == 0:
                # дождались
                print("component has no pending processes more")
                for v in self.pending_updates[component_name]:
                    print("sending reply to allow put operation",self.entity_id + "/" + component_name)
                    self.rapi.put_reply( v, {"may_submit":True})
                self.pending_updates[component_name] = []

    def get_outgoing_links(self):
        if self.entity_id not in self.local_world.links:
            return []
        return self.local_world.links[ self.entity_id ]

    #F-COMP-SYNC    
    def setup_sync(self):

        self.active_processes = {} #F-ACTIVE-PROC
        # список процессов которые обрабатывают эту сущность

        ### входящий запрос на обновление компоненты
        # таблица компонента -> [сообщения]
        # список запросов на обновления, которые надо разослать когда компонента освободится
        self.pending_updates = {}

        # таблица компонента -> процессы
        # список процессов, которые ожидает компонента для обработки
        # чтобы получить входящие обновления
        self.pending_processes = {}

        # неотправленные значения которые ждут разрешения
        # таблица компонента -> id канала цели -> счетчик
        self.pending_outputs = {}

        def on_put_request(v):
            
            # ну вот нам прислали запрос чтобы обновить компоненту
            #component_name = v["component_name"]
            component_name = v["component_name"]
            opkey = self.entity_id + "/" + component_name
            print(">> put request to entity ", opkey)
            #print("v=",v)
            #print(">> request to update component_name=",component_name)
            if self.has_component( component_name ):
                c = self.get_component( component_name )

                # список процессов которые вычитывают эту компоненту                
                known_processes_arr = list( self.local_world.component_processes[component_name].keys() )

                locks = []
                for marker in known_processes_arr:
                    if marker in c: #F-SYNC-PROC
                        # уже обработано процессом этим
                        pass
                    else:
                        # этот процесс пока не обрабатывал эту компоненту
                        # сообразно это есть причина блокировки (одна из)

                        if marker in self.active_processes:
                            locks.append( marker )
                            # поставили пометку но только если этот процесс активный
                            # по отношению к этой сущности
                            #F-ACTIVE-PROC

                        # но вот тут у нас и проблема а что если процесс её читает
                        # ну просто так, на всякий случай, как метку что это надо обрабатывает
                        # а сообразно если у кого-то нет метки то мы все-равно поставим
                        # на блокировку

                if len(locks) == 0:
                    print(">> sending OK - no locks on component", opkey)
                    self.rapi.put_reply( v, {"may_submit":True})
                else:
                    if component_name not in self.pending_updates:
                        self.pending_updates[ component_name ] = []
                    self.pending_updates[ component_name ].append( v )
                    print(">> not sending reply - adding locks",locks,opkey)

                    for marker in locks:
                        if component_name not in self.pending_processes:
                            self.pending_processes[ component_name ] = {}
                        self.pending_processes[ component_name ][marker] = 1
                        # запомнили что компонента ждет обработки процессом marker
                        # и затем ее готовы обновить
            else:
                # компоненты такой нет, присылайте
                print(">> sending OK - may put - no component.",opkey)
                self.rapi.put_reply( v, {"may_submit":True})
            

        #self.put_request_ch = self.rapi.channel(f"{self.id}/put_request")
        #self.put_request_ch.react( on_put_request )        
        self.rapi.sync_query( f"{self.id}/put_request",on_put_request )

        ### управление входящими компонентами        
        def on_put(v):
            # ну вот нам прислали входящее значение            
            #component_name = v["component_name"]
            component_name = v["component_name"]
            #print(">> component_name=",component_name)
            print(">> got incoming put! ",self.entity_id + "/" + component_name)
            #print("v=",v)
            #self.pending_updates[component_name] = [] очищается в другом месте
            #self.pending_processes[component_name] = {}
            #self.pending_outputs[component_name] = {}
            
            self.update_component( component_name, v)

        self.put_component_ch = self.rapi.channel(f"{self.id}/put")
        self.put_component_ch.react( on_put )



    def has_component( self, component_name ):
        if component_name in self.components:
            return True
        return False        

    def get_component( self, component_name ):
        return self.components[ component_name ]

    def remove_component( self, component_name ):
        print("entity",self.entity_id,"remove component",component_name)
        del self.components[ component_name ]
        self.local_world.remove_component( self.id,component_name)

    # создает каналы для чтения и записи компонент
    def create_component_links( self,component_name ):
        # исходящие каналы
        #print("create_component_links entity",self.entity_id,"component",component_name)
        if not component_name in self.component_channels_out:
            c = self.rapi.channel(f"{self.id}/{component_name}/out")
            self.component_channels_out[component_name] = c
        # входящие каналы для обновления компонент
        #if not component_name in self.component_channels_in:
            c = self.rapi.channel(f"{self.id}/{component_name}/in")
            self.component_channels_in[component_name] = c
            def on_update_component(v):
                print("ecs: entity",self.entity_id,"got external update to component",component_name)
                self.update_component(component_name,v)
            c.react(on_update_component)

            """
            c = self.rapi.channel(f"{self.id}/{component_name}/rm")
            self.component_channels_rm[component_name] = c
            def on_remove_component(v):
                print("ecs: entity",self.entity_id,"got external remove component",component_name)
                self.remove_component(component_name,v)
            c.react(on_remove_component)
            """

    def update_component( self,component_name, component_value ):
        self.components[ component_name ] = component_value

        self.local_world.add_component( self.id,component_name, component_value )

        # вроде как уже и не надо
        #self.create_component_links( component_name )

        # ppk todo возникает задача мониторить деревья каналов в смысле a/b/c : a/*
        # это нужно для оптимизации
        # и еще пока этого не сделать то компонент обязательно должен быть создан
        # заранее (статично или динамично), чтобы принимать обновления

        # и теперь послать сигнал
        #ch = self.component_channels_out[component_name]
        print("ecs: update_component called: entity_id=",self.entity_id,"component_name",component_name)        

        #ch.put( component_value )

        # а теперь новый протокол #F-COMP-SYNC-REQ  
        """
                    rec = { "target_entity_d": v["target_entity_id"], 
                    "target_component_name": v["target_component_name"],
                    "locks": {} }
        """
        outgoing_links = self.get_outgoing_links()
        if component_name in outgoing_links:
            recs = outgoing_links[component_name]
            print("have outgoing_links",len(recs))
            for rec in recs:
                #tgt_channel = rec["target_put_request_ch"]
                #msg = component_value
                msg = {}
                msg["component_name"] = rec.target_component_name

                def mk_may_submit(rec,component_name, component_value):
                    def may_submit(okmsg): # можно посылать                    
                        #print("ecs: update_component: got reply to update request...")
                        #tgt_put_channel = rec["target_put_ch"]
                        msg = component_value
                        msg["component_name"] = rec.target_component_name
                        msg["label"] = rec.target_put_label
                        # разрешили - получите                        
                        print("ecs: update_component: got reply to update request, now sending value to remote:", rec.target_key,"to channel",rec.target_put_label)
                        #tgt_put_channel.put( msg )
                        self.rapi.put_msg( msg )
                
                        # очистим список исходящих блокировок                        
                        if component_name in self.pending_outputs:                            
                            if rec.target_key in self.pending_outputs[component_name]:
                                del self.pending_outputs[component_name][rec.target_key]

                    return may_submit

                print("ecs: update_component: sending request to update",rec.target_key,"to ch",rec.target_put_request_label)
                #print("ecs: update_component: sending request to update",component_name,"to ch",tgt_channel.id, "msg=",msg)
                
                if component_name not in self.pending_outputs:
                    self.pending_outputs[component_name] = {}
                # todo должна быть одна тут, может стоит ругаться
                key = rec.target_key
                if rec.target_put_request_label not in self.pending_outputs[component_name]:
                    self.pending_outputs[component_name][key] = 1
                else:                    
                    self.pending_outputs[component_name][key] = self.pending_outputs[component_name][rec.target_put_request_label] + 1
                    print("warning: more than one pending output in entity",self.entity_id,"component_name=",component_name,"remote=",key)

                #tgt_channel.sync_request( msg,mk_may_submit(rec,component_name, component_value) )
                msg["label"] = rec.target_put_request_label                
                self.rapi.put_request( msg, mk_may_submit(rec,component_name, component_value) )
        else:
            print("have 0 outgoing_links")

        #component_name  = v["component_name"]
        #component_value = v["component_value"]
        #if "payload" in v:
        #    component_value["data"] = v["payload"]                    

# цикл ecs
# сделан отдельно потому что оказалось надо контролировать когда он может начинать работу
# ибо если не все загрузить то перекашивается (уже идут отправки но нет еще подписчиков между воркерами)
# ну и плюс для управляемости на будущее
class Simulation:
    def __init__(self):
        self.distribution = []

    def deploy( self,workers ):
        for w in workers:
            print("deploy simulation to worker",w.id)
            nodes = gen.node( "simulation" )
            w.put( {"description":nodes,"action":"create"})

class simulation:
    def __init__(self,rapi,description,parent):
        print("ecs simulation item created")
        gen.apply_description( rapi, self, description )

        self.local_world = description["local_world"]
        self.local_systems = description["local_systems"]

        self.RUN_SYSTEMS = LoopComponent(self.local_systems,self.local_world)
        rapi.atexit( self.RUN_SYSTEMS.stop )


################

#LOCAL_WORLD = World()
#LOCAL_SYSTEMS = []
#ECS_PROCESSOR = None

#import builtins
#builtins.LOCAL_SYSTEMS = LOCAL_SYSTEMS

################

def init(*args):
    gen.register({"entity":entity})    
    gen.register({"link":link})
    gen.register({"simulation":simulation})
    #nonlocal ECS_PROCESSOR
    #ECS_PROCESSOR = LoopComponent()