extends CanvasLayer

var orbitling: Node

@onready var debug_label: Label = $PanelContainer/MarginContainer/DebugLabel

func set_orbitling(orbitling_node: Node) -> void:
	orbitling = orbitling_node

func _process(_delta: float) -> void:
	if orbitling == null:
		debug_label.text = "Orbitling: not found"
		return

	var stats = orbitling.stats
	debug_label.text = "\n".join([
		"Orbitling Debug",
		"Name: %s" % stats.creature_name,
		"Speed: %.1f" % stats.speed,
		"Bond: %.1f" % stats.bond,
		"Mood: %.1f" % stats.mood,
		"Hunger: %.1f" % stats.hunger,
		"State: %s" % orbitling.current_state,
	])
