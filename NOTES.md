# LT-Delete-hidden-lanes
Deletes hidden lanes on one-way segments

When editor selects a segment, DHL needs to check to see if the segment selected is one-way.
If selected segment is one, look at the inbound node to the segment to determine if there are lanes on it
If there are lanes on the inbound node, provide a button to allow editor to delete the lanes on the inbound node


Checking to see if one-way

If 
W.selectionManager.getSelectedFeatures()[0].model.attributes.revDirection = False
and 
W.selectionManager.getSelectedFeatures()[0].model.attributes.revLaneCount > 0

or 
If 
W.selectionManager.getSelectedFeatures()[0].model.attributes.fwdDirection = False
and 
W.selectionManager.getSelectedFeatures()[0].model.attributes.fwdLaneCount > 0

then

Don't know how to change the LaneCount to 0


