#!/usr/bin/env -S node
// --inspect

/* сервис промис

   todo
     create_promises(N) -> [...N promises...]
     - работа с идентификаторами: резолв по идентификатору, например. с авто-созщданием промисы/
     - ожидание по идентификатору даже не созданной промисы - разрешить.
     - но в целом надо уже двигаться к таскам и с ними увязывать.
   
   идея - удобно было бы query на методы класса положить ))))
   идея - мб пусть по айдишникам всегда все работает на вход, и не надо hdl передавать. а может и на выход.
          а там в клиентское апи уже обернуть.
*/

import * as PPK from "ppk"
import * as PL from "./lib.js"

PPK.prefix_console_log( () => ["[promises-srv]",performance.now()] )

PPK.connect("promises-srv").then( PL.promises_service_logic )

