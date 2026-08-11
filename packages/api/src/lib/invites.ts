import { GetCommand, UpdateCommand } from '@aws-sdk/lib-dynamodb';
import { ddb, TABLE } from './dynamo';
import type { Invite } from '@gallery/shared';

const itemToInvite = (item: Record<string, unknown>): Invite => ({
  token: item['token'] as string,
  projectIds: (item['projectIds'] as string[]) ?? [],
  label: item['label'] as string | undefined,
  createdAt: item['createdAt'] as string,
  createdBy: item['createdBy'] as string,
  revoked: Boolean(item['revoked']),
  useCount: (item['useCount'] as number) ?? 0,
  lastUsedAt: item['lastUsedAt'] as string | undefined,
});

export const getInvite = async (token: string | undefined): Promise<Invite | null> => {
  if (!token) return null;
  const result = await ddb.send(new GetCommand({
    TableName: TABLE,
    Key: { PK: `INVITE#${token}`, SK: 'METADATA' },
  }));
  return result.Item ? itemToInvite(result.Item) : null;
};

export const getValidInvite = async (token: string | undefined): Promise<Invite | null> => {
  const invite = await getInvite(token);
  if (!invite || invite.revoked) return null;
  return invite;
};

export const touchInvite = async (token: string): Promise<void> => {
  await ddb.send(new UpdateCommand({
    TableName: TABLE,
    Key: { PK: `INVITE#${token}`, SK: 'METADATA' },
    UpdateExpression: 'SET lastUsedAt = :now ADD useCount :one',
    ExpressionAttributeValues: { ':now': new Date().toISOString(), ':one': 1 },
  }));
};

export { itemToInvite };
