extends Node2D
class_name Food

@export_range(0.0, 100.0) var nutrition: float = 22.0

func consume() -> float:
	queue_free()
	return nutrition
