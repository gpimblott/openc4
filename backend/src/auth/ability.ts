import { createMongoAbility, AbilityBuilder } from '@casl/ability';
import type { User, AppAbility } from './types.js';

/**
 * Builds and returns a CASL Ability instance representing the granular permissions
 * granted to the given user based on their role and attributes.
 */
export function defineAbilityFor(user: User): AppAbility {
  const { can, cannot, build } = new AbilityBuilder<AppAbility>(createMongoAbility);

  if (user.role === 'admin') {
    // Admin has full control over all subjects and actions
    can('manage', 'all');
  } else if (user.role === 'editor') {
    // Editor/Architect can read, create, modify, delete elements, and publish workspaces
    can('read', 'Workspace');
    can('create', 'Workspace');
    can('update', 'Workspace');
    can('delete', 'Workspace');
    can('publish', 'Workspace');

    // Editors cannot manage system users
    cannot('manage', 'User');
  } else {
    // Viewer has read-only access to workspaces
    can('read', 'Workspace');

    cannot('create', 'Workspace');
    cannot('update', 'Workspace');
    cannot('delete', 'Workspace');
    cannot('publish', 'Workspace');
    cannot('manage', 'User');
  }

  return build();
}
