import * as core from '@actions/core'
import * as github from '@actions/github'

async function execute() {
  try {
    const token = core.getInput('token', { required: true })
    let excludeList = core.getInput('exclude').split(',')

    const context = github.context

    const owner = context.repo.owner
    const repo = context.repo.repo
    const pull_number = context.payload.pull_request?.number
    const issue_number = context.issue.number

    if (!pull_number) {
      return core.setFailed(`Pull request number is missing from context`)
    }

    const octokit = github.getOctokit(token)
    // Fetch pull request info
    const { data: pullRequest } = await octokit.rest.pulls.get({
      owner,
      repo,
      pull_number
    })
    const assigneeLogins = pullRequest.assignees?.map(
      assignee => assignee.login
    )
    const reviewerLogins = pullRequest.requested_reviewers?.map(
      reviewer => reviewer.login
    )

    // Add the author of the pull request to the exclude list, since they can't be a reviewer
    if (!excludeList.includes(pullRequest.user.login)) {
      excludeList.push(pullRequest.user.login)
    }

    // Add and remove reviewers/assignees when there's a difference between the 2 lists
    core.info('Workflow triggered on action : ' + context.payload.action)
    core.info('Current reviewers : [' + reviewerLogins + ']')
    core.info('Current assignees : [' + assigneeLogins + ']')
    core.info('Will ignore these users : [' + excludeList + ']')

    console.log(context.payload)
    switch (context.payload.action) {
      case 'assigned':
        const newlyAssigned = context.payload.assignee.login
        console.log('newlyAssigned', newlyAssigned)

        const shouldAddReviewer =
          !reviewerLogins?.includes(newlyAssigned) &&
          !excludeList.includes(newlyAssigned)

        if (shouldAddReviewer) {
          core.info('Request to add reviewers : [' + newlyAssigned + ']')
          await octokit.rest.pulls.requestReviewers({
            owner,
            repo,
            pull_number,
            reviewers: [newlyAssigned]
          })
          core.info('Reviewers added : [' + newlyAssigned + ']')
        } else {
          core.info('No reviewer to be added')
        }
        break
      case 'unassigned':
        const newlyUnassigned = context.payload.assignee.login
        console.log('newlyUnassigned :>> ', newlyUnassigned)
        const shouldRemove =
          reviewerLogins?.includes(newlyUnassigned) &&
          !excludeList.includes(newlyUnassigned)

        if (shouldRemove) {
          core.info('Request to remove reviewers : [' + newlyUnassigned + ']')
          await octokit.rest.pulls.removeRequestedReviewers({
            owner,
            repo,
            pull_number,
            reviewers: [newlyUnassigned]
          })
          core.info('Reviewers removed : [' + newlyUnassigned + ']')
        } else {
          core.info('No reviewer to be removed')
        }
        break
      case 'review_requested':
        const newlyRequested = context.payload.requested_reviewer.login
        const shouldAddAssignee =
          !assigneeLogins?.includes(newlyRequested) &&
          !excludeList.includes(newlyRequested)

        if (shouldAddAssignee) {
          core.info('Request to add assignees : [' + newlyRequested + ']')
          await octokit.rest.issues.addAssignees({
            owner,
            repo,
            issue_number,
            assignees: newlyRequested
          })
          core.info('Assignees added : [' + newlyRequested + ']')
        } else {
          core.info('No assignees to be added')
        }
        break

      case 'review_request_removed':
        const newlyRemoved = context.payload.requested_reviewer.login
        const shouldRemoveAssignee =
          assigneeLogins?.includes(newlyRemoved) &&
          !excludeList.includes(newlyRemoved)

        if (shouldRemoveAssignee) {
          core.info('Request to remove assignees : [' + newlyRemoved + ']')
          await octokit.rest.issues.removeAssignees({
            owner,
            repo,
            issue_number,
            assignees: newlyRemoved
          })
          core.info('Assignees removed: [' + newlyRemoved + ']')
        } else {
          core.info('No assignees to be removed')
        }
        break
    }
  } catch (error) {
    if (error instanceof Error) {
      core.setFailed(error.message)
    } else {
      core.setFailed('Unknown error occurred')
    }
  }
}

execute()
