extends Node
class_name RaceController

signal race_finished(finish_order: Array[EventParticipant])

@export var finish_x: float = 520.0

var participants: Array[EventParticipant] = []
var finish_order: Array[EventParticipant] = []
var is_race_over: bool = false

func setup_race(p_participants: Array[EventParticipant], p_finish_x: float) -> void:
	participants = p_participants
	finish_x = p_finish_x
	finish_order.clear()
	is_race_over = false

	for participant in participants:
		participant.distance_traveled = 0.0
		participant.finished = false
		participant.finish_rank = -1

func _physics_process(delta: float) -> void:
	if is_race_over:
		return

	for participant in participants:
		if participant.finished:
			continue
		if participant.creature_node == null or not is_instance_valid(participant.creature_node):
			continue

		var step := participant.speed * delta
		participant.creature_node.global_position.x += step
		participant.distance_traveled += step

		if participant.creature_node.global_position.x >= finish_x:
			participant.finished = true
			participant.finish_rank = finish_order.size() + 1
			finish_order.append(participant)

	if finish_order.size() == participants.size() and participants.size() > 0:
		is_race_over = true
		race_finished.emit(finish_order)
