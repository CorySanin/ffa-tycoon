# Park Submission Guide

## Requirements

A park must meet this requirements in order to be considered for the FFA Tycoon map pool:

- Must be submitted by its author or the submitter must have obtained permission from the park's author
    - Keep in mind that the license for this repo is MIT
- One map per submission
    - Submitting different types of the same map in the same submission is fine
- Filename must be all lowercase, use underscores instead of spaces, and suffixed by a hyphen and the scenario type
- Adequate amount of park staff for when the park is fully developed
- All park entrances are connected via pathways
- Differs from other parks currently in the map pool in some way. For example:
    - Unique terrain/layout
    - Ride selection
    - Scenery/general aesthetic
    - Climate
    - Difficulty
- One of each type of basic amenity
    - Food
    - Drink
    - Restroom
- At least one ride (optional but recommended)

## Preparing Park for Submission

There are two types of scenarios: sandbox and economy. The process of converting one to the other can be quite tedious, so it is recommended that you first prepare an economy-oriented park (that is, enable the cash machine stall) and then put that through the [save prep tool](https://prep.ffa-tycoon.com/).

The tool will output two saves. One will have money enabled and each player will start with the amount specified in the "economy funds" field. The other will have money disabled and the cash machine removed from the object selection. It also resets the date, removes all guests, sets the scenario goal to "have fun," and some other changes to make all parks in the pool a bit more uniform. Check out the [save prep source code](https://gitlab.com/sanin.dev/ffa-tycoon-scenario-prep/-/blob/saveprep/src/openrct2/cmdline/PrepCommand.cpp) to dig deeper.

One last thing to consider is that wherever the view port is pointing at when you save the park last will be where players connecting to the server will be pointed at. In the past, parks have started zoomed out, as to not highlight any one particular plot of land in a park. However, going forward the viewport should be zoomed in to a highlight of the park. The reason being that even my beefy rig gets very poor performance when zoomed all the way out.

## Submitting a Park

You have your park save(s) and they meet all the requirements. Now what?

1. Create a GitHub account if you don't already have one
1. [Fork this repo](https://github.com/CorySanin/ffa-tycoon/fork) (or pull from upstream if your fork is behind)
1. Clone your fork
1. Create a new branch (a good name would be the name of your park)
1. Move your saves to their respective folders in the project (parks/sandbox and parks/economy)
1. Commit and push
1. [Create a pull request](https://github.com/CorySanin/ffa-tycoon/pulls) from your branch
1. If you have more to submit, switch back to the master brach and go back to step 4

## Submitting a Park with GitHub Desktop

If you're unfamiliar with git, no problem! You can [install GitHub Desktop](https://desktop.github.com/) and follow along below

[Fork this repo](https://github.com/CorySanin/ffa-tycoon/fork)

1. In GitHub Desktop, click "clone a repository from the internet." In the GitHub.com tab, it will list your repos. If your fork isn't there, click the link on the dialog to refresh your repos. Select your fork of ffa-tycoon. Note the destination directory (local path) and click "clone."

1. If it asks how you plan to use the fork, select "to contribute to the parent project."

1. Select Branch → New branch. Give it the name of your park.

1. open up the repo in your file browser by pressing <kbd>Ctrl</kbd> + <kbd>Shift</kbd> + <kbd>F</kbd>. Place your save files into the correct directory (parks\sandbox and parks\economy).

1. Switch back to GitHub Desktop. The files you've added should appear in the changes section on the left side. Add a commit message and commit the change to your branch.

1. Select Repository → Push. Then Branch → Create pull request. On the webpage, click "Create pull request." Periodically check on the pull request to see if it has been given feedback or has been merged.

If a change is requested, update your park and go back to step 4. If it has been merged, prepare for a new submission. In GitHub Desktop, in the current branch dropdown, select default branch master. You can go back to step 3 to start a new submission.

## Getting Upstream Changes in GitHub Desktop

If your fork is too far behind upstream, there's apparently [no simple way to do this in GitHub Desktop](https://github.com/desktop/desktop/issues/4527).

[Download git](https://git-scm.com/downloads) if you don't already have it. (Note that you don't need Windows Explorer integration. The other defaults are fine.) Restart GitHub Desktop.

Make sure default branch master is the current branch. Then select Repository → Open in Command Prompt.

Type the following into the terminal and push enter: `git pull upstream master`

Close the terminal window and return to GitHub Desktop. You can go back to step 3 to start a new submission.