// назначать задачи - обеспечивает передачу задач процессам получения задач
// есть стало быть метод получения задач..
// или таки очередь для входящих задач????
// ну и короче есть как-то информация о местах куда задачи можно направлять
// ну и место по умолчанию, например.

// читает задачи из очереди, ведет учет получателей задач, назначает задачи им
import {Solver} from "../services/runner/solver5.js"

class TaskAssignProcess() {
	constructor( rapi, incoming_tasks_queue="exec-request-ready", runner_info_queue="runner-info", verbose ) {
		this.rapi = rapi
		this.incoming_tasks_queue = incoming_tasks_queue
		this.runner_info_queue = runner_info_queue

		// todo ...
		let task_assigned = (msg, runner_id) => {
			this.rapi.wait_promise( msg.id ).then( () => {
				solver.runner_finished(  runner_id, msg.id, msg )
			})
		}

		this.solver = new Solver( rapi,verbose, task_assigned )
		// todo: stop queryies
		rapi.query( incoming_tasks_queue ).done( msg => {
			solver.add_request( msg.id, msg )
		})

		rapi.query( runner_info_queue ).done( msg => {
			if (verbose)
			  console.log('got runner-info',msg)
			solver.add_runner_info(  msg.task_label, msg )    

			rapi.get_list( msg.task_label ).then( list => {
			  //console.log('got list, setting ondelete',msg.task_label)
			    list.ondelete = (reaction_id,reaction_body) => {
			      console.log('ondelete called',{reaction_id,reaction_body})
			      if (reaction_body.arg.value == msg.task_label) { 
			        console.log("match. detaching runner",reaction_body.arg.value)
			        // признак раннера - т.е. удаляется его query.. 
			        //  но что если его квери удаляется по внутренней ошибке?
			        solver.runner_detached( reaction_body.arg.value )
			      }
			    }
			})
		})
	}
}

// получать задачи - обеспечивает получение задач для выполнения
// есть стало быть некая входящая очередь
// есть стало быть и некие параметры для рекламы себя любимого
// и есть стало быть параметр - куда слать полученные задачи.
// подразумевается что это будет использоваться конечно локально
// но в целом должно быть без разницы.
class TaskQueryProcess() {
	constructor( rapi, runner_info_queue="runner-info", incoming_queue ) 
	{
		this.rapi = rapi
		incoming_queue ||= rapi.
	}
	set_limits( limits ) 
	{
	}
	change_needs( added_needs, removed_needs ) 
	{
	}
}

// отслеживает готовность задач - согласно промисам
// есть входящая очередь - туда слать задачи
// ну и видимо есть исходящая очередь - туда посылаются разрезолвленные задачи..
class TaskResolveProcess() {
	constructor( rapi, incoming_queue ) {
		this.rapi = rapi
	}
}

// выполняет задачи
// есть очередь входящих задач которые надо выполнять
// ну и по мере сил эти задачи выполняются. ниды ихние и т.п.
class TaskExecutorProcess() {
	constructor( rapi, incoming_queue ) {
		this.rapi = rapi
	}
}