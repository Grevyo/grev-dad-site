extends CanvasLayer

@export var orbitling_path: NodePath

@onready var debug_label: Label = $PanelContainer/MarginContainer/DebugLabel
var orbitling: Node
var status_message: String = "No save activity yet"

func _ready() -> void:
	if orbitling_path != NodePath():
		orbitling = get_node_or_null(orbitling_path)

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
		"State: %s" % orbitling.state_machine.current_state,
		"Save Key: F5",
		"Load Key: F9",
		"Save Status: %s" % status_message,
	])

func set_status_message(message: String) -> void:
	status_message = message
