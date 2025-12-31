import {
  DevPlan,
  Epic,
  Milestone,
  Sprint,
  Story,
  Task,
} from '../types/devPlanTypes';

// this function construct a map of { story key => [story.name, story.storyPoint] }
// to syncing storypoints in different devplan struct
// see `syncMilestoneToEpic` for more details
function constructStoryMap(
  targets: ReadonlyArray<Milestone | Sprint | Epic | Story | Task>,
  output: { [id: string]: [string, string, number] }
) {
  (targets || []).forEach((target) => {
    if ('children' in target && target.children) {
      constructStoryMap(target.children, output); // First process the children
    }

    output[target.key!] = [
      target.name,
      target.description ?? '',
      target.storyPoint,
    ];
  });
}

// this function fixing story's name and story point using a ref map
// constructed by funcion `constructStoryMap`
// see `syncMilestoneToEpic` for more details
function fixingByStoryMap(
  targets: Array<Milestone | Sprint | Epic | Story | Task>,
  refMap: { [id: string]: [string, string, number] }
) {
  let list = targets || [];
  for (let index = list.length - 1; index >= 0; --index) {
    let target = targets[index];
    if ('children' in target && target.children) {
      fixingByStoryMap(target.children, refMap); // First process the children
    } else {
      let obj = refMap[target.key!];
      if (obj) {
        [target.name, target.description, target.storyPoint] = obj;
      } else {
        targets.splice(index, 1);
      }
    }
  }
}

/**
 * milestone and epics don't share same story instance in devplan,
 * we need to copy your changed story point and name in milestones to epics.
 */
export function syncMilestoneToEpic(devplan: DevPlan) {
  let map: { [id: string]: [string, string, number] } = {};
  constructStoryMap(devplan.milestones, map);
  console.log('in syncMilestoneToEpic, map:', devplan.milestones, map);
  fixingByStoryMap(devplan.epics, map);
  console.log('in syncMilestoneToEpic, epics:', devplan.epics);
}

export function syncEpicInMilestone(devplan: DevPlan) {
  (devplan.milestones || []).forEach((milestone) => {
    (milestone.epics || []).forEach((epic) => {
      (devplan.epics || []).forEach((fixedEpic) => {
        if (fixedEpic.key === epic.key) {
          epic.storyPoint = fixedEpic.storyPoint;
          epic.totalStoryPoint = fixedEpic.storyPoint;
        }
      });
    });
  });
}
