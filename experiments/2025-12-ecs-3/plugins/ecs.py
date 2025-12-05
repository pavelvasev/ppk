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
                        component = e.get_component(component_name)
                        component[marker] = 1
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

        self.outgoing_links = dict()
        c = self.rapi.channel(f"{self.id}/{component_name}/in")
        self.component_channels_in[component_name] = c
        def on_update_component(v):
            print("ecs: entity",self.entity_id,"got external update to component",component_name)
            self.update_component(component_name,v)
        c.react(on_update_component)        

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

        self.create_component_links( component_name )

        # ppk todo возникает задача мониторить деревья каналов в смысле a/b/c : a/*
        # это нужно для оптимизации
        # и еще пока этого не сделать то компонент обязательно должен быть создан
        # заранее (статично или динамично), чтобы принимать обновления

        # и теперь послать сигнал
        ch = self.component_channels_out[component_name]
        print("ecs: update_component: sending update",component_name,"to ch",ch.id)        
        ch.put( component_value )
        

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