/** Keep unfinished re-deployment visible, but never list an uninstalled instance. */
export function isVisibleModelInstance(instance: {
  actual_state: string;
  desired_state: string;
  operation_id: string | null;
}): boolean {
  return instance.actual_state !== 'REMOVED'
    || (instance.desired_state === 'RUNNING' && !!instance.operation_id);
}
