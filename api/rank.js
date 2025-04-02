export async function GET(request) {
  const response = await fetch("https://api.vercel.app/products");
  const products = await response.json();
  return Response.json(products);
}
