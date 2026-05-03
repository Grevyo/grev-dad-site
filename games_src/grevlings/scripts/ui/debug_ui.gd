extends CanvasLayer

var orbitling: Node
var status_message: String = ""
var scene_mode: String = ""

@onready var debug_label: Label = $PanelContainer/MarginContainer/DebugLabel

func set_orbitling(orbitling_node: Node) -> void:
	orbitling = orbitling_node

func set_status_message(message: String) -> void:
	status_message = message

func set_scene_mode(mode: String) -> void:
	scene_mode = mode

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
		"Scene: %s" % scene_mode,
		"Status: %s" % status_message,
	])
