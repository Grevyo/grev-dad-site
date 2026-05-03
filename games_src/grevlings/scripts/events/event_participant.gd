extends RefCounted
class_name EventParticipant

enum ParticipantType {
	LOCAL_PLAYER_CREATURE,
	CPU_CREATURE,
	REMOTE_PLAYER_CREATURE,
}

var slot_index: int
var participant_type: ParticipantType
var display_name: String
var speed: float
var creature_node: Node2D
var distance_traveled: float = 0.0
var finished: bool = false
var finish_rank: int = -1

func _init(
	p_slot_index: int,
	p_participant_type: ParticipantType,
	p_display_name: String,
	p_speed: float,
	p_creature_node: Node2D
) -> void:
	slot_index = p_slot_index
	participant_type = p_participant_type
	display_name = p_display_name
	speed = p_speed
	creature_node = p_creature_node
