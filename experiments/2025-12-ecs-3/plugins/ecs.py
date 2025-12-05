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
    print("################################### world begin")
    print("################ entities view")    
    for entity_id, e in w.entities.items():
        print( " * ",entity_id, ":", " ".join(sorted(e.components.keys())) )
    print("################ components view")
    for component_name, e in w.components.items():
        print( " - ",component_name, ":"," ".join(sorted(w.components[component_name].keys()) ))        
    print("################################### world done")        

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
    print("################################### world done")        

class World:
    def __init__(self):
        self.entities = {}
        self.components = {} # Stores components by type, then by entity ID

        self.component_processes = {}

    """
    def create_entity(self,entity_id):
        #entity_id = len(self.entities) # Simple ID generation
        entity = Entity(entity_id)
        self.entities[entity_id] = entity
        return entity_id
    """    

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

    def get_entities_with_components(self, *component_types, marker=None):
        # Returns entity IDs that have all specified component types
        if not component_types:
            return self.entities.keys()

        #F-COMP-SYNC
        if marker is not None:
            for comp_type in component_types:
                if comp_type not in self.component_processes:
                    self.component_processes[ comp_type ] = []
                self.component_processes[ comp_type ].append(marker)

        first_component_entities = set(self.components.get(component_types[0], {}).keys())
        
        if not first_component_entities:
            return set()

        for comp_type in component_types[1:]:
            current_component_entities = set(self.components.get(comp_type, {}).keys())
            first_component_entities.intersection_update(current_component_entities)
            if not first_component_entities:
                break # Optimization: if intersection becomes empty, no need to continue

        if marker is not None:
            # фильтр по маркеру
            # правило: никакая из запрошенных компонент не должна содержать маркер
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
                        break

                if not marker_found:
                    cc.add( entity_id )
                    for component_name in component_types:                        
                        e.component_processed( component_name, marker )

            return cc

        return first_component_entities

    def get_entities_with_components_verbose(self, *component_types):
        # Returns entity IDs that have all specified component types
        print("get_entities_with_components_verbose: component_types=",component_types)
        if not component_types:
            print("no component_types, return empty set")
            return self.entities.keys()

        first_component_entities = set(self.components.get(component_types[0], {}).keys())
        print("* first_component_entities=",first_component_entities)        
        
        if not first_component_entities:
            print("no first_component_entities, return empty set")
            return set()

        print("entering loop")

        for comp_type in component_types[1:]:
            current_component_entities = set(self.components.get(comp_type, {}).keys())
            print("* component",comp_type,"entities =",current_component_entities)
            first_component_entities.intersection_update(current_component_entities)
            print("  current result",first_component_entities)
            if not first_component_entities:                
                break # Optimization: if intersection becomes empty, no need to continue

        print("loop finished. result:",first_component_entities)
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

                #print_world( self.local_world )

                # Передаем управление event loop'у
                #await asyncio.sleep(1)
                #await asyncio.sleep(0.1)
                await asyncio.sleep(0.0000001)

        except asyncio.CancelledError:
            print("LoopComponent: Задача была отменена")
            raise
        except Exception as e:
            print("LoopComponent: Произошла ошибка",e)
            #traceback.print_exc()
            #traceback.print_stack()
            traceback.print_exc()


        finally:
            print("LoopComponent: Цикл завершен")
    
    async def stop(self):
        """Остановка компоненты."""
        if self._task and not self._task.done():
            self._running = False
            self._task.cancel()
            try:
                await self._task
            except asyncio.CancelledError:
                pass
    
    def is_running(self) -> bool:
        """Проверка, работает ли компонента."""
        return self._running and self._task and not self._task.done()


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

        if component_name in self.pending_processes:
            print("see component in pending_processes")
            del e.pending_processes[component_name][process_id]

            if len(e.pending_processes[component_name].keys()) == 0:
                # дождались
                print("component has no pending processes more")
                for v in e.pending_updates:
                    print("sending reply to allow put operation",v)
                    self.rapi.sync_reply( v, {"may_submit":True})

    #F-COMP-SYNC    
    def setup_sync(self):

        ################################
        ### добавление исходящих ссылок
        # идея если надо можем положить и во входящих
        self.outgoing_links = dict()
        c = self.rapi.channel(f"{self.id}/manage")        
        def on_manage(v):
            print("ecs: entity",self.entity_id,"got external link info to component",v)
            #self.update_component(component_name,v)
            component_name = v["component_name"]            
            if not component_name in self.outgoing_links:
                self.outgoing_links[component_name] = []    

            # todo может достаточно и канала, это мб было бы и лучше
            # с точки зрения маршрутизации. ну посмотрим
            target_channel_id = v["target_entity_id"] + "/put_request"
            target_channel = self.rapi.channel(target_channel_id)
            target_channel_id2 = v["target_entity_id"] + "/put"
            target_channel2 = self.rapi.channel(target_channel_id)

            rec = { "target_entity_d": v["target_entity_id"], 
                    "target_component_name": v["target_component_name"],
                    "target_put_request_id":target_channel_id,
                    "target_put_request_ch":target_channel,
                    "target_put_ch":target_channel2,
                    "locks": {} }
            self.outgoing_links[component_name].append(rec)
        c.react(on_manage)
        self.manage_ch = c

        ### входящий запрос на обновление компоненты
        self.pending_updates = {}
        self.pending_processes = {}
        def on_put_request(v):
            print("entity ",self.entity_id,"got put request",v)
            # ну вот нам прислали
            #component_name = v["component_name"]
            component_name = v["value"]["component_name"]
            if self.has_component( component_name ):
                c = self.get_component( component_name )

                # список процессов которые вычитывают эту компоненту
                known_processes_arr = self.local_world.component_processes[component_name]

                locks = []
                for marker in known_processes_arr:
                    if marker in c: #F-SYNC-PROC
                        # уже обработано процессом этим
                        pass
                    else:
                        locks.append( marker ) # причина блокировки

                if len(locks) == 0:
                    print("sending OK - no locks on component")
                    self.rapi.sync_reply( v, {"may_submit":True})
                else:
                    if component_name not in self.pending_updates:
                        self.pending_updates[ component_name ] = []
                    self.pending_updates[ component_name ].append( v )
                    print("not sending - adding locks",locks)

                    for marker in locks:
                        if component_name not in self.pending_processes:
                            self.pending_processes[ component_name ] = {}    
                        self.pending_processes[ component_name ][marker] = 1
                        # запомнили что компонента ждет обработки процессом marker
                        # и затем ее готовы обновить
            else:
                # компоненты такой нет, присылайте
                print("sending OK - no component. v=",v)
                self.rapi.sync_reply( v, {"may_submit":True})
            

        #self.put_request_ch = self.rapi.channel(f"{self.id}/put_request")
        #self.put_request_ch.react( on_put_request )        
        self.rapi.sync_query( f"{self.id}/put_request",on_put_request )

        ### управление входящими компонентами        
        def on_put(v):
            # ну вот нам прислали входящее значение
            print("entity ",self.entity_id,"got put!",v)
            #component_name = v["component_name"]
            component_name = v["component_name"]
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
        if component_name in self.outgoing_links:
            recs = self.outgoing_links[component_name]
            print("have outgoing_links",recs)
            for rec in recs:
                tgt_channel = rec["target_put_request_ch"]
                #msg = component_value
                msg = {}
                msg["component_name"] = rec["target_component_name"]

                def mk_may_submit(rec,component_value):
                    def may_submit(okmsg): # можно посылать                    
                        tgt_put_channel = rec["target_put_ch"]
                        msg = component_value                    
                        msg["component_name"] = rec["target_component_name"]
                        # разрешили - получите
                        print("ecs: update_component: got reply to update request, now sending value",component_name,"to ch",tgt_put_channel.id)
                        tgt_put_channel.put( msg )
                    return may_submit

                print("ecs: update_component: sending request to update",component_name,"to ch",tgt_channel.id, "msg=",msg)
                tgt_channel.sync_request( msg,mk_may_submit(rec,component_value) )
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


################

#LOCAL_WORLD = World()
#LOCAL_SYSTEMS = []
#ECS_PROCESSOR = None

#import builtins
#builtins.LOCAL_SYSTEMS = LOCAL_SYSTEMS

################

def init(*args):
    gen.register({"entity":entity})    
    gen.register({"simulation":simulation})
    #nonlocal ECS_PROCESSOR
    #ECS_PROCESSOR = LoopComponent()