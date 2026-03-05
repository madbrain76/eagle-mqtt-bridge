const EAGLE_IDENTIFIER = 'rfeagle'

var messageset = {}

function buildDiscovery(topic_base) {
	for (const key of Object.keys(messageset)) {
		delete messageset[key]
	}

	const eagle_device = {
	  "payload_available": "online",
	  "payload_not_available": "offline",
	  "device": {
	    "identifiers": [
	      EAGLE_IDENTIFIER
	    ],
	    "name": "Rainforest Eagle",
	    "manufacturer": "Rainforest Automation",
	    "model": "Eagle"
	  }
	}
	eagle_device["availability_topic"] = topic_base + "/availability"


	const eagle_meter_demand_topic = 'homeassistant/sensor/rfeagle_power_demand/config'
	const eagle_meter_demand_message = {
	  ...eagle_device,
	  "name": "Power Demand",
	  "unique_id": "rfeagle_power_demand",
	  "unit_of_measurement": "W",
	  "device_class": "power",
	  "state_class": "measurement"
	}
	eagle_meter_demand_message["state_topic"] = topic_base + "/meter/demand"

	const eagle_meter_delivered_topic = 'homeassistant/sensor/rfeagle_energy_imported_from_grid/config'
	const eagle_meter_delivered_message = {
	  ...eagle_device,
	  "name": "Energy Imported from Grid",
	  "unique_id": "rfeagle_energy_imported_from_grid",
	  "unit_of_measurement": "kWh",
	  "state_class": "total_increasing",
	  "device_class": "energy"
	}
	eagle_meter_delivered_message["state_topic"] = topic_base + "/meter/imported"

	const eagle_meter_received_topic = 'homeassistant/sensor/rfeagle_energy_exported_to_grid/config'
	const eagle_meter_received_message = {
	  ...eagle_device,
	  "name": "Energy Exported to Grid",
	  "unique_id": "rfeagle_energy_exported_to_grid",
	  "unit_of_measurement": "kWh",
	  "state_class": "total_increasing",
	  "device_class": "energy"  
	}
	eagle_meter_received_message["state_topic"] = topic_base + "/meter/exported"

	messageset[eagle_meter_demand_topic] = JSON.stringify(eagle_meter_demand_message)
	messageset[eagle_meter_delivered_topic] = JSON.stringify(eagle_meter_delivered_message),
	messageset[eagle_meter_received_topic] = JSON.stringify(eagle_meter_received_message)
}

module.exports = { buildDiscovery, messageset }
