import { createContext } from 'react';
import { createMongoAbility, AbilityBuilder } from '@casl/ability';
import type { MongoAbility } from '@casl/ability';

export type UserRole = 'admin' | 'editor' | 'viewer';
export type Actions = 'manage' | 'create' | 'read' | 'update' | 'delete' | 'publish';
export type Subjects = 'Workspace' | 'User' | 'all';

export type AppAbility = MongoAbility<[Actions, Subjects]>;

export const AbilityContext = createContext<AppAbility>(createMongoAbility());

export function defineAbilityFor(role: UserRole | null = null): AppAbility {
  const { can, cannot, build } = new AbilityBuilder<AppAbility>(createMongoAbility);

  if (role === 'admin') {
    can('manage', 'all');
  } else if (role === 'editor') {
    can('read', 'Workspace');
    can('create', 'Workspace');
    can('update', 'Workspace');
    can('delete', 'Workspace');
    can('publish', 'Workspace');
    cannot('manage', 'User');
  } else if (role === 'viewer') {
    can('read', 'Workspace');
    cannot('create', 'Workspace');
    cannot('update', 'Workspace');
    cannot('delete', 'Workspace');
    cannot('publish', 'Workspace');
    cannot('manage', 'User');
  } else {
    // Unauthenticated: cannot perform any action
    cannot('manage', 'all');
  }

  return build();
}
