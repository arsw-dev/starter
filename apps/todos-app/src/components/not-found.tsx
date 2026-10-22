import { Link } from '@tanstack/react-router';

const NotFound = () => {
  return (
    <div>
      <p>Not Found</p>
      <Link to={'/'}>Back Home</Link>
    </div>
  );
};

export { NotFound };
