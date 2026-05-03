extends CharacterBody2D

@export var move_speed: float = 220.0

func _physics_process(_delta: float) -> void:
	var move_input := Input.get_vector("move_left", "move_right", "move_up", "move_down")
	velocity = move_input * move_speed
	move_and_slide()
