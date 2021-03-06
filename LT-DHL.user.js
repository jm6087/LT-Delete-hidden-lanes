// ==UserScript==
// @name         WME Lane Tools - Delete Hidden Lanes
// @namespace    https://github.com/jm6087/
// @version      2020.06.04.02
// @description  Deletes hidden lanes on one-way segments so you don't have to convert lanes to two-way first
// @include      /^https:\/\/(www|beta)\.waze\.com\/(?!user\/)(.{2,6}\/)?editor\/?.*$/
// @exclude      https://www.waze.com/user/editor*
// @author       jm6087 (with lots of help from SkiDooGuy - THANKS)
// @grant        none
// ==/UserScript==

(function(){
       'use strict';
    var UPDATE_NOTES = `Hopefully deletes hidden lanes <br><br>
    var VERSION = GM_info.script.version;
    var SCRIPT_NAME = GM_info.script.name;

function deleteLanes(dir) {   

  const selObj = W.selectionManager.getSelectedFeatures();
  const selSeg = selObjs[0].model;
  const segFwdLanes = selSeg.fwdLaneCount;
  const segRevLanes = selSeg.revLaneCount;
  const segFwdDir = selSeg.fwdDirection;
  const segRevDir = selSeg.revDireciton;
  
//	Do we need to look at the "turn graph"?  I ask because if there are lanes on a segment then LaneCount will be > 0
// Then we grab the entire turn graph, this is where information about turns between segments is stored
    const turnGraph = W.model.getTurnGraph();
// This is a "require" which calls a module within WME
    const mAction = new MultiAction();
    
// These next three variables are empty and are just being set up for later use
    let node;
    let conSegs
// I do want to mention that this object declaration is important, as it's how we'll group and pass our desired
// changes to WME
    let updates = {};

// Don't worry about this for now, I again barely understand it. Just accept it's needed. :)
    mAction.setModel(W.model);
    
    If (dir === 'fwd');{
    
// here we are saving into our updates object the fact that we want the fwd lane count to be 0
        updates.fwdLaneCount = 0;

// Next we grab the B node by using the getObjectById function in the nodes model and plugging in the toNodeID which
// is an attribute in the segment 
        node = W.model.nodes.getObjectById(selSeg.attributes.toNodeID);
    
// This will get all the segment ids attached to the node we stored in the "node" variable above
        conSegs = node.getSegmentIds();
 
 // These next two lines will change the actual displayed value of lanes in the lanes tab of the segment        
        $('.fwd-lanes').find('.form-control').val(0);
        $('.fwd-lanes').find('.form-control').change();
    }
 
// Same as above, but for the reverse B->A direction
    if (dir === 'rev') {
        updates.revLaneCount = 0;
        node = W.model.nodes.getObjectById(selSeg.attributes.fromNodeID);
        conSegs = node.getSegmentIds();
        $('.rev-lanes').find('.form-control').val(0);
        $('.rev-lanes').find('.form-control').change();
    }
    
     // Now we take the action from wither the fwd or rev function above and store it as a subaction in our multiaction that we
    // will pass to the actionManager for saving once finished
    mAction.doSubAction(new UpdateObj(selSeg, updates));
    
    // Now for the more complicated part! We have our array of segment ids for the segments connected to the node we gathered above
    // and we will cycle through all of them to check for lane-turn associations. The way this is written is important, if you look
    // through it carefully, you'll see that we never do any comparison to ensure we aren't checking the turn info from the original
    // segment back to itself. As there is lane association for a U-Turn, we need to check for that.
    // Similar to For i = 0 to conSegs.length (variable) step 1 (i++ is step 1)
    for (let i=0;i < conSegs.length; i++) {

        // This is a complicated funtion, but what it's doing is grabbing the turn information through the node we collected above,
        // from the selected segment, to one of the segments attached to the node. The node and first segment are static and always
        // the same. The second segment is called each time by plugging in the segment ID stored in conSegs in position [i]
        
        // turnGraph variable created on line 22 = W.model.getTurnGraph().getTurnThroughNode(node - value returned from line 56,elSeg = selObjs[0].model, each segment ID)
                let turnStatus = turnGraph.getTurnThroughNode(node, selSeg, W.model.segments.getObjectById(conSegs[i]));
                
        // This simply stores information that is one level deeper than the data returned by the above variable, which makes accessing
        // certain information faster
        let turnData = turnStatus.getTurnData();   
        
                // Now we check to make sure that turn path has lanes associated with it
        if (turnData.hasLanes()) {
        
            // If it does, we call a function that allows us to quickly indcate we want no lanes associated with it as (), if we 
            // wanted some lanes we'd say withLanes (2), which would associate 2 lanes with it. (This might be a little incorrect, but
            // the gist is true, it might be a little more technical requiring us to indicate, starting from 0, which lanes)
            turnData = turnData.withLanes();
            
              // Next we store each action, if there is one, for each turn path as a subaction in our multiaction
            mAction.doSubAction(new SetTurn(turnGraph, turnStatus));
        }
    }

    // Finally we add the multiaction to the action manager, which will trigger the 1 on the save button, we also added a description
    // to the multication to display to editors what happened
    mAction._description = 'Tried to do what SkiDoo said to do';
    W.model.actionManager.add(mAction);
};
    function bootstrap(tries = 1) {
        if (W && W.map && W.model && W.loginManager.user && $ && WazeWrap.Ready ) {
            deletelanes()
            WazeWrap.Interface.ShowScriptUpdate(SCRIPT_NAME, VERSION, UPDATE_NOTES);
            console.log(SCRIPT_NAME, "loaded");
        } else if (tries < 1000)
            setTimeout(function () {bootstrap(++tries);}, 200);
    }
    bootstrap();
})();
