import { Issue, Prisma, Project } from '@prisma/client';

import { getHeaders } from '../../../common/util/apiHeaders';
import { api_url } from '../../../lib/constants';
import {
  AddAndPublishIssueInput,
  IssueSuggestionOutput,
} from '../../issues/types/issueTypes';

export async function updateIssue(issue: Partial<Issue>): Promise<Issue> {
  const headers = await getHeaders();
  const result = await fetch(`${api_url}/api/issues/update`, {
    method: 'POST',
    headers,
    credentials: 'include',
    body: JSON.stringify(issue),
  });
  const { success, data, errorMsg } = await result.json();
  if (!success) {
    throw new Error('Error updating issue: ' + errorMsg);
  }
  return data;
}

export async function addIssueSuggestion(
  issue: Partial<Issue>
): Promise<IssueSuggestionOutput> {
  const headers = await getHeaders();
  const result = await fetch(`${api_url}/api/issues/addSuggestion`, {
    method: 'POST',
    headers,
    credentials: 'include',
    body: JSON.stringify(issue),
  });
  const { success, data, errorMsg } = await result.json();
  if (!success) {
    throw new Error('Error adding issue suggestion: ' + errorMsg);
  }
  return data;
}

export async function addIssuePublish(
  input: AddAndPublishIssueInput
): Promise<Project> {
  const headers = await getHeaders();
  const result = await fetch(`${api_url}/api/issues/addPublish`, {
    method: 'POST',
    headers,
    credentials: 'include',
    body: JSON.stringify(input),
  });
  const { success, data, errorMsg } = await result.json();
  if (!success) {
    throw new Error('Error adding and publishing issue: ' + errorMsg);
  }
  return data;
}

/**
 * This API is added to achieve the simple task of adding an issue.
 *
 * It needs to exist becaue the pre-existing functionality is deeply broken,
 *  and instead of building further into it, a cleaner approach will be to
 *  create this new method to use while we re-evaluate how to fix the old one.
 */
export async function addIssue(
  input: Prisma.IssueUncheckedCreateInput
): Promise<Project> {
  const headers = await getHeaders();
  const result = await fetch(`${api_url}/api/issues/`, {
    method: 'POST',
    headers,
    credentials: 'include',
    body: JSON.stringify(input),
  });
  const { success, data, errorMsg } = await result.json();
  if (!success) {
    throw new Error('Error adding issue: ' + errorMsg);
  }
  return data;
}
