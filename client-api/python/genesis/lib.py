# создание объектов в нашем стиле (используется для yaml-описания)

import ppk
import ppk.utils

types = {}

def register(more_types):
    global types
    types = {**types,**more_types}

#class scope:
#    def __init__(self):

#todo scope - надо это все делать в рамках некоего scope. world назвать
# и параметры ему дать, такие как cwd да и много других.. (пользовательских)
created_objects_ids = {}  # id -> obj
created_objects_tags = {} # tag_id -> obj,obj,...

def get_objects_by_tag( tag ):
    if tag in created_objects_tags:
        return created_objects_tags[tag]
    return []

def get_object_by_id( id ):
    if id in created_objects_ids:
        return created_objects_ids[id]
    return None

def apply_description( rapi, obj, description ):
    obj.stop_functions = []
    
    if "params" in description:
        ch_assign_attrs( obj, description["params"] )
    if "links_out" in description:
        ch_bind_out_links( rapi,obj, description["links_out"] )
    if "links_in" in description:
        ch_bind_in_links( rapi,obj, description["links_in"] )
    if "items" in description:
        create_children( rapi, obj, description["items"] )

def register_object(id,value):
    global created_objects_ids
    created_objects_ids[id] = value


def register_object_tags(tags,value):
    global created_objects_tags
    for tag in tags:
        if tag in created_objects_tags:
            created_objects_tags[tag].append(value)
        else:
            created_objects_tags[tag] = [value]

def unregister_object(id,value):    
    global created_objects_ids
    del created_objects_ids[id]

def unregister_object_tags(tags,value):
    global created_objects_tags
    for tag in tags:
        if tag in created_objects_tags:
            created_objects_tags[tag].remove(value)


def create_objects(rapi, description, parent_id):
    if isinstance(description,list):
        for x in description:
            create_object( rapi, x, parent_id )
    else:
        create_object( rapi, description, parent_id )

def create_object(rapi, description, parent_id):
    #print("genesis: create_object type=",description["type"])
    if not description["type"] in types:
        print("========================= genesis error")
        print("create_object: cannot find fn for type",description["type"],"description=",description)
        print("=========================")
        # надо все-таки ошибку, а то оно молча продолжает работать
        raise Exception('genesis', 'type not found',description["type"])
        return False

    fn = types[description["type"]]

    if parent_id in created_objects_ids:
        parent = created_objects_ids[parent_id]
    else:
        parent = parent_id # это может быть и объект

    # всякие apply_description считается будут вызваны внутри fn
    obj = fn( rapi, description, parent )

    if "id" in description:
        register_object( description["id"], obj )
        obj.external_id = description["id"]
    if "tags" in description:
        register_object_tags( description["tags"], obj )
        # вот так объект мог бы узнать о тегах. да и об id тоже. но пока не надо
        # да вроде уже надо
        obj.tags = description["tags"]

    if parent:
        if not hasattr(parent,"genesis_children"):
            parent.genesis_children = []
        parent.genesis_children.append(obj)

    return obj

def delete_object( obj ):
    #print("GEN: delete_object",obj)
    if hasattr(obj,"genesis_deleted"):
        return

    if hasattr(obj,"tags"):
        unregister_object_tags( obj.tags, obj )
    if hasattr(obj,"external_id"):
        unregister_object( obj.external_id,obj )
    if hasattr(obj,"stop_functions"):
        for x in obj.stop_functions:
            x()
    if hasattr(obj,"delete_object"):
        obj.delete_object()

    if hasattr(obj,"genesis_children"):
        cc = obj.genesis_children.copy()
        for o in cc:
            delete_object( o )
        obj.genesis_children = []

    if hasattr(obj,"parent") and hasattr(obj.parent,"genesis_children"):
        obj.parent.genesis_children.remove(obj)

    obj.genesis_deleted = True

# obj - родительский объект, items - список описаний объектов
def create_children( rapi, obj, items ):    
    for x in items:
        o = create_object( rapi, x, obj )

def ch_assign_attrs( obj, params):
    #print("params=",params)
    for name in params:        
        #path = name.split(".")        
        #attr = path[-1]
        attr = name
        if hasattr( obj, attr ):
            val = getattr(obj,attr)
            if hasattr( val, "is_channel" ):
                # канал
                val.put( params[name] )
                #print("genesis: ch_assign_attrs: setting channel name =",name)
            else:
                # константа
                setattr(obj,attr,params[name])
                #print("genesis: ch_assign_attrs: setting const param name =",name)
        else:
            print("genesis: ch_assign_attrs: cannot find attr for param=",name,"of object",obj)


def ch_bind_in_links(rapi, obj, links_in):
    #print("ch_bind_in_links:", links_in)
    for local_name, sources in links_in.items():
        local_channel = getattr(obj,local_name)
        if local_channel:  # todo проверить что это канал
            for ch_name in sources:
                #print("ch_bind_in_links: query ", ch_name, "to local_name=", local_name)
                #print("ch_bind_in_links: see local channel(or cell), adding subscribers listen. local_name=",local_name,"ch_name=",ch_name)

                def mk_cb( local_channel, local_name ):
                    # todo 1 а почему тут не bind вообще?
                    # 2 и также бы сделать через bind :initial_value. надо подумать.
                    def callback(value):
                        #print("IN_LINK: local channel CB",local_name,"<--",ch_name)
                        """ todo
                        if hasattr(msg, 'payload'):
                            if hasattr(msg, 'value'):
                                msg.value.payload = msg.payload
                        """        
                        #print("in-links eeee msg!", local_name, value)
                        local_channel.put(value)
                    return callback

                callback = mk_cb( local_channel, local_name )
                stop_fn = rapi.channel(ch_name).react( callback )
                
                obj.stop_functions.append( stop_fn )

                stop_fn = rapi.channel(ch_name+":initial_value").react( callback, 1 )

                obj.stop_functions.append( stop_fn )
                #rapi.channel(ch_name+":subscribed").put("new_subscriber_id")

                #print("ch_bind_in_links: bound channel",ch_name,"to prop",local_name)
        else:
            print(f"ch_bind_in_links: cannot find local channel for param={local_name} of object {obj}", 
                  file=sys.stderr)

def ch_bind_out_links(rapi, obj, links):
    for local_name, global_channel_ids in links.items():
        local_channel = getattr(obj,local_name)
        if local_channel:
            #print("~~~~~~~~~~ ch_bind_out_links: see local channel(or cell), adding subscribers listen. local_name=",local_name,"global_channel_ids=",global_channel_ids)

            def mk_cb( global_channel_ids ):
                global_channels = []
                for ch_name in global_channel_ids:
                    cc = None
                    if isinstance(ch_name,list):
                        # todo систематизировать это все, сделать прямо методы питона
                        method = ch_name[0]
                        if method == "delay":
                            if len(ch_name) >= 3:
                                delay = float( ch_name[2] )
                            else:
                                delay = 0.1
                            dpass = ppk.utils.DelayedPass(delay=delay)
                            ctgt = rapi.channel(ch_name[1])
                            ppk.local.bind( dpass.output, ctgt )
                            cc = dpass.input
                    else:
                        cc = rapi.channel(ch_name)
                    global_channels.append( cc )

                def callback(value):              
                    for ch in global_channels:
                        #print("   ~~~~~~~~~~ cb of ch_bind_out_links: sending local channel ",local_name,"value to global",ch.id )#,"object_id=",obj.external_id)
                        #rapi.msg({"label": ch_name, "value": value})
                        #rapi.verbose=True
                        #ch.debug=True
                        ch.put( value )
                return callback

            callback = mk_cb( global_channel_ids )
            
            stop_fn = local_channel.react(callback)
            obj.stop_functions.append( stop_fn )

            if hasattr(local_channel,"is_cell"):                
                #def s_callback(new_subscriber):
                #    print("ch_bind_out_links: see new subscriber",new_subscriber)
                for ch_name in global_channel_ids:
                    #print("---->",ch_name)
                    if isinstance(ch_name,list):                        
                        print(1)
                        method = ch_name[0]
                        if method == "delay":
                            ch_name = ch_name[1]
                    #print("!!!!---->",ch_name)        
                    c = rapi.channel(ch_name+":initial_value").cell()
                    ppk.local.bind( local_channel, c )
                    # типа раз он уже и так ячейка. ничего плохого не будет если мы
                    # будем хранить ссылку на значение еще раз
                    # todo разобраться что все это значит, :initial_value
                    # но похоже это как раз вывод локальных каналов в глобальную форму
                    # для посылки значений вновь подключающимся (локальные это делать не умеют,
                    # только на уровне react)

            #print("ch_bind_out_links: bound local channel",local_name,"to global channels:",globals)
        else:
            print(f"ch_bind_out_links: cannot find local channel for param={local_name} of object {obj}", 
                  file=sys.stderr)


import string
import random

def id_generator(size=10, chars=string.ascii_uppercase + string.digits):
    return ''.join(random.choice(chars) for _ in range(size))    
