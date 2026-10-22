import { useAppStatus } from '#/stores/app-status.ts';

// Over whatever page is showing, once a read has failed on todos-api's side
const AppFailure = () => {
  const failure = useAppStatus((state) => state.failure);

  if (!failure) return null;

  return (
    <dialog open aria-labelledby="app-failure">
      <h2 id="app-failure">Something went wrong</h2>
      <p>The page couldn't load everything it needs. Reloading may fix it.</p>
      <button
        type="button"
        onClick={() => {
          location.reload();
        }}
      >
        Reload
      </button>
    </dialog>
  );
};

export { AppFailure };
