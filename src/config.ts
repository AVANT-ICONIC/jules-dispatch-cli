export interface Config {
  julesApiKey: string;

}

export function loadConfig(): Config {
  const julesApiKey = process.env.JULES_API_KEY;


  if (!julesApiKey) {
    throw new Error(
      'JULES_API_KEY is not set. Copy .env.example to .env and add your Jules API key.'
    );
  }


  return { julesApiKey };
}
