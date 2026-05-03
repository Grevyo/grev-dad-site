extends RefCounted
class_name CreatureStateMachine

signal state_changed(new_state: String)

var current_state: String = "Idle"

func set_state(new_state: String) -> void:
	if current_state == new_state:
		return
	current_state = new_state
	state_changed.emit(current_state)
