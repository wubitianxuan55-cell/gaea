import { useState, useEffect } from 'react';

export function useModuleData<T>(endpoint: string, initialData: T | null = null) {
  const [data, setData] = useState<T | null>(initialData);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<Error | null>(null);

  useEffect(() => {
    let isMounted = true;
    
    setLoading(true);
    fetch(endpoint)
      .then(res => {
        if (!res.ok) throw new Error(`Failed to fetch from ${endpoint}`);
        return res.json();
      })
      .then(json => {
        if (isMounted) {
          setData(json);
          setLoading(false);
        }
      })
      .catch(err => {
        if (isMounted) {
          console.error(`Error fetching ${endpoint}:`, err);
          setError(err);
          setLoading(false);
        }
      });

    return () => {
      isMounted = false;
    };
  }, [endpoint]);

  return { data, loading, error, setData };
}
