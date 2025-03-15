# создание объектов в нашем стиле (используется для yaml-описания)

import ppk

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

def apply_description( rapi, obj, description ):
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

def create_objects(rapi, description, parent_id):
    if isinstance(description,list):
        for x in description:
            create_object( rapi, x, parent_id )
    else:
        create_object( rapi, description, parent_id )

def create_object(rapi, description, parent_id):
    print("genesis: create_object type=",description["type"])
    if not description["type"] in types:
        print("========================= error")
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
    if "tags" in description:
        register_object_tags( description["tags"], obj )
        # вот так объект мог бы узнать о тегах. да и об id тоже. но пока не надо
        # да вроде уже надо
        obj.tags = description["tags"]

    return obj

# obj - родительский объект, items - список описаний объектов
def create_children( rapi, obj, items ):
    for x in items:
        create_object( rapi, x, obj )

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
                print("genesis: ch_assign_attrs: setting channel name =",name)
            else:
                # константа
                setattr(obj,attr,params[name])
                print("genesis: ch_assign_attrs: setting const param name =",name)
        else:
            print("genesis: ch_assign_attrs: cannot find attr for param=",name,"of object",obj)


def ch_bind_in_links(rapi, obj, links_in):
    #print("ch_bind_in_links:", links_in)
    for local_name, sources in links_in.items():
        local_channel = getattr(obj,local_name)
        if local_channel:  # todo проверить что это канал
            for ch_name in sources:
                #print("ch_bind_in_links: query ", ch_name, "to local_name=", local_name)

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
                rapi.channel(ch_name).react( callback )

                rapi.channel(ch_name+":initial_value").react( callback, 1 )
                #rapi.channel(ch_name+":subscribed").put("new_subscriber_id")

                print("ch_bind_in_links: bound channel",ch_name,"to prop",local_name)
        else:
            print(f"ch_bind_in_links: cannot find local channel for param={local_name} of object {obj}", 
                  file=sys.stderr)

def ch_bind_out_links(rapi, obj, links):
    for local_name, globals in links.items():
        local_channel = getattr(obj,local_name)
        if local_channel:

            def mk_cb( globals ):
                global_channels = []
                for ch_name in globals:
                    global_channels.append( rapi.channel(ch_name) )

                def callback(value):              
                    for ch in global_channels:
                        print("ch_bind_out_links: sending local channel ",local_name,"value to global",ch_name)
                        #rapi.msg({"label": ch_name, "value": value})
                        ch.put( value )
                return callback

            callback = mk_cb( globals )
            
            unsub = local_channel.react(callback)

            if getattr(local_channel,"is_cell"):
                print("ch_bind_out_links: see local cell, adding subscribers listen")
                #def s_callback(new_subscriber):
                #    print("ch_bind_out_links: see new subscriber",new_subscriber)
                for ch_name in globals:
                    c = rapi.channel(ch_name+":initial_value").cell()
                    ppk.local.bind( local_channel, c )
                    # типа раз он уже и так ячейка. ничего плохого не будет если мы
                    # будем хранить ссылку на значение еще раз

            print("ch_bind_out_links: bound local channel",local_name,"to global channels:",globals)
        else:
            print(f"ch_bind_out_links: cannot find local channel for param={local_name} of object {obj}", 
                  file=sys.stderr)


import string
import random

def id_generator(size=10, chars=string.ascii_uppercase + string.digits):
    return ''.join(random.choice(chars) for _ in range(size))    
